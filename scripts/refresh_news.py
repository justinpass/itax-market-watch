#!/usr/bin/env python3
"""Refresh ITAX Market Watch from configured official sources.

Design goal: zero database and zero AI dependency for the MVP. The job runs in
GitHub Actions, normalises source items, updates data/market.json and commits only
when new items are found. Vercel then redeploys automatically from the repository.

The collectors are intentionally simple and isolated. If an authority changes its
HTML, update config/sources.json or the small extraction helpers below rather than
the application UI.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import feedparser
import httpx
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "frontend" / "data" / "market.json"
SOURCES_FILE = ROOT / "config" / "sources.json"
KEYWORDS_FILE = ROOT / "config" / "topic_keywords.json"
USER_AGENT = "ITAX-Market-Watch/0.1 (+tax-intelligence-dashboard)"

BUSINESS_IMPACT = {
    "P2": "Review Pillar Two calculations, data mappings, local filing dependencies and process ownership for affected entities.",
    "TP": "Assess whether intercompany pricing, operating margins or documentation need to respond to the development.",
    "PE": "Review activities, people and contracting patterns that could create or change taxable presence.",
    "RES": "Reassess governance, substance and management-location evidence for affected entities.",
    "WHT": "Model the cash-tax effect on cross-border payments and confirm treaty or domestic relief conditions.",
    "FIN": "Review financing structures, interest limitations and after-tax funding costs.",
    "VAT": "Map affected transaction flows, invoicing logic, reporting fields and implementation dates.",
    "CES": "Check payment-reporting data quality, scope logic and operational ownership.",
    "DEAL": "Assess transaction economics, customs or restructuring consequences and implementation dependencies.",
    "DAC": "Review reportable population, data availability, due dates and control evidence for EU reporting obligations.",
    "DISC": "Identify new reporting fields, system changes, ownership and evidence needed for compliance.",
    "MAP": "Evaluate controversy exposure, evidence preservation and available dispute-resolution routes.",
    "TREATY": "Identify payment flows or structures affected by treaty changes and model source-country exposure.",
    "CFC": "Review entity-level income, exemptions and effective tax rates for CFC exposure.",
    "DST": "Assess market-jurisdiction revenue, nexus and digital-tax overlap with other international tax rules.",
    "US": "Identify US-linked entities and transactions that may need modelling, process or reporting changes.",
}

CLIENT_QUESTION = {
    "P2": "Does the current Pillar Two data and filing model still work under the latest guidance?",
    "TP": "Who should bear the changed cost or return under the current transfer-pricing model?",
    "PE": "Do current activities create a taxable presence that is not reflected in the operating model?",
    "RES": "Is the entity's residence and substance position supported by current facts and governance?",
    "WHT": "What tax is retained from the payment, and can treaty or domestic relief be secured?",
    "FIN": "How does the change affect the after-tax cost and deductibility of financing?",
    "VAT": "Which transaction flows, invoices or reporting systems need to change?",
    "CES": "Are all reportable payment flows captured and reconciled correctly?",
    "DEAL": "What could change the transaction economics or implementation plan?",
    "DAC": "Which entities, sellers or arrangements become reportable, and what data is missing?",
    "DISC": "What new reporting obligation or system control is required?",
    "MAP": "What is the exposure and which route gives the strongest path to tax certainty?",
    "TREATY": "Which cross-border payments or structures are affected by the treaty development?",
    "CFC": "Which foreign entities could now create CFC income or reporting exposure?",
    "DST": "Where could digital-tax nexus or overlapping tax claims arise?",
    "US": "Which US-linked business flows need to be recalculated or re-documented?",
}

TAX_HINTS = {
    "tax", "vat", "customs", "transfer", "withholding", "pillar", "globe",
    "cbam", "treaty", "reporting", "corporate", "revenue", "minimum tax",
    "e-invoicing", "disclosure", "audit", "pricing", "import", "export",
}


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", BeautifulSoup(value, "html.parser").get_text(" ")).strip()


def canonical_url(url: str) -> str:
    parsed = urlparse(url)
    return parsed._replace(fragment="", query="").geturl().rstrip("/")


def make_id(url: str) -> str:
    return hashlib.sha1(canonical_url(url).encode("utf-8")).hexdigest()[:14]


def parse_date(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip()
    # ISO date/time first.
    match = re.search(r"(20\d{2})-(\d{2})-(\d{2})", value)
    if match:
        return match.group(0)
    # English textual dates common on authority websites.
    for fmt in ("%d %B %Y", "%d %b %Y", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            pass
    return None


def classify(title: str, summary: str, keywords: dict[str, list[str]]) -> tuple[str, int]:
    haystack = f"{title} {summary}".lower()
    scores: list[tuple[int, str]] = []
    for topic, terms in keywords.items():
        score = sum(4 if term.lower() in title.lower() else 2 for term in terms if term.lower() in haystack)
        if score:
            scores.append((score, topic))
    if not scores:
        # General authority updates default to disclosure rather than pretending a
        # substantive tax classification is known.
        return "DISC", 0
    scores.sort(reverse=True)
    return scores[0][1], scores[0][0]


def tax_relevant(title: str, summary: str, classification_score: int) -> bool:
    if classification_score > 0:
        return True
    haystack = f"{title} {summary}".lower()
    return any(hint in haystack for hint in TAX_HINTS)


def importance_score(topic: str, title: str, classification_score: int) -> int:
    base = 58 + min(classification_score * 4, 20)
    high_signal = ["enters into force", "effective", "legislation", "guidance", "consultation", "deadline", "reporting", "implementation"]
    base += sum(4 for term in high_signal if term in title.lower())
    if topic in {"P2", "DAC", "VAT", "DEAL"}:
        base += 4
    return min(base, 96)


def extract_published(soup: BeautifulSoup) -> str | None:
    meta_candidates = [
        ("meta", {"property": "article:published_time"}, "content"),
        ("meta", {"name": "date"}, "content"),
        ("meta", {"name": "DC.date"}, "content"),
        ("meta", {"name": "dcterms.date"}, "content"),
    ]
    for tag, attrs, attr in meta_candidates:
        node = soup.find(tag, attrs=attrs)
        if node and node.get(attr):
            parsed = parse_date(str(node.get(attr)))
            if parsed:
                return parsed
    time_node = soup.find("time")
    if time_node:
        parsed = parse_date(str(time_node.get("datetime") or time_node.get_text(" ", strip=True)))
        if parsed:
            return parsed
    return None


def extract_description(soup: BeautifulSoup) -> str:
    for attrs in ({"name": "description"}, {"property": "og:description"}):
        node = soup.find("meta", attrs=attrs)
        if node and node.get("content"):
            return clean_text(str(node.get("content")))[:900]
    first_p = soup.find("p")
    return clean_text(first_p.get_text(" ", strip=True) if first_p else "")[:900]


def fetch_article(client: httpx.Client, url: str) -> tuple[str, str | None]:
    try:
        response = client.get(url, follow_redirects=True)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        return extract_description(soup), extract_published(soup)
    except Exception as exc:  # noqa: BLE001 - one bad source must not stop the job
        print(f"article fetch failed: {url}: {exc}")
        return "", None


def collect_rss(source: dict[str, Any], keywords: dict[str, list[str]]) -> list[dict[str, Any]]:
    feed = feedparser.parse(source["url"], request_headers={"User-Agent": USER_AGENT})
    results: list[dict[str, Any]] = []
    for entry in feed.entries[:40]:
        title = clean_text(entry.get("title"))
        summary = clean_text(entry.get("summary") or entry.get("description"))
        url = str(entry.get("link") or "")
        if not title or not url:
            continue
        topic, score = classify(title, summary, keywords)
        if not tax_relevant(title, summary, score):
            continue
        published = parse_date(str(entry.get("published") or entry.get("updated") or "")) or date.today().isoformat()
        results.append(normalise(source, title, summary, url, published, topic, score, date_basis="published"))
    return results


def collect_html_links(client: httpx.Client, source: dict[str, Any], keywords: dict[str, list[str]]) -> list[dict[str, Any]]:
    response = client.get(source["url"], follow_redirects=True)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    contains = source.get("link_contains", "")
    seen: set[str] = set()
    results: list[dict[str, Any]] = []
    for anchor in soup.find_all("a", href=True):
        title = clean_text(anchor.get_text(" ", strip=True))
        href = str(anchor.get("href"))
        if len(title) < 18 or (contains and contains not in href):
            continue
        url = canonical_url(urljoin(source["url"], href))
        if url in seen:
            continue
        seen.add(url)
        summary, published = fetch_article(client, url)
        topic, score = classify(title, summary, keywords)
        if not tax_relevant(title, summary, score):
            continue
        date_basis = "published" if published else "retrieved"
        results.append(normalise(source, title, summary, url, published or date.today().isoformat(), topic, score, date_basis=date_basis))
        if len(results) >= 20:
            break
    return results


def normalise(
    source: dict[str, Any],
    title: str,
    summary: str,
    url: str,
    published: str,
    topic: str,
    classification_score: int,
    *,
    date_basis: str,
) -> dict[str, Any]:
    return {
        "id": make_id(url),
        "title": title[:220],
        "source": source["name"],
        "url": canonical_url(url),
        "published": published,
        "date_basis": date_basis,
        "jurisdiction": source.get("jurisdiction", "Global"),
        "topic": topic,
        "importance": importance_score(topic, title, classification_score),
        "summary": summary[:900] or "Official-source update. Open the source for the full text.",
        "business_impact": BUSINESS_IMPACT.get(topic, BUSINESS_IMPACT["DISC"]),
        "client_question": CLIENT_QUESTION.get(topic, CLIENT_QUESTION["DISC"]),
    }


def main() -> None:
    market = read_json(DATA_FILE)
    sources = read_json(SOURCES_FILE)
    keywords = read_json(KEYWORDS_FILE)
    existing = {canonical_url(item["url"]): item for item in market.get("updates", []) if item.get("url")}
    found: list[dict[str, Any]] = []

    with httpx.Client(timeout=20, headers={"User-Agent": USER_AGENT}) as client:
        for source in sources:
            if not source.get("enabled", True):
                continue
            try:
                if source["type"] == "rss":
                    found.extend(collect_rss(source, keywords))
                elif source["type"] == "html_links":
                    found.extend(collect_html_links(client, source, keywords))
                else:
                    print(f"unsupported source type: {source['type']}")
            except Exception as exc:  # noqa: BLE001
                print(f"source failed: {source['name']}: {exc}")

    for item in found:
        existing[item["url"]] = item

    merged = list(existing.values())
    merged.sort(key=lambda item: (item.get("published", ""), item.get("importance", 0)), reverse=True)
    market["updates"] = merged[:120]
    market["generated_at"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    write_json(DATA_FILE, market)
    print(f"Saved {len(market['updates'])} updates ({len(found)} collected this run).")


if __name__ == "__main__":
    main()
