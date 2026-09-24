from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Query

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "frontend" / "data" / "market.json"
SOURCES_FILE = ROOT / "config" / "sources.json"

app = FastAPI(
    title="ITAX Market Watch API",
    version="0.1.0",
    description="Read-only API for the ITAX Market Watch MVP.",
)


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_market() -> dict[str, Any]:
    return load_json(DATA_FILE)


@app.get("/")
def api_root() -> dict[str, str]:
    return {"name": "ITAX Market Watch API", "status": "ok"}


@app.get("/health")
def health() -> dict[str, Any]:
    market = load_market()
    return {
        "status": "ok",
        "generated_at": market.get("generated_at"),
        "topics": len(market.get("topics", [])),
        "updates": len(market.get("updates", [])),
    }


@app.get("/market")
def market() -> dict[str, Any]:
    return load_market()


@app.get("/topics")
def get_topics() -> list[dict[str, Any]]:
    return load_market().get("topics", [])


@app.get("/updates")
def get_updates(
    topic: str | None = None,
    jurisdiction: str | None = None,
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict[str, Any]]:
    updates = load_market().get("updates", [])
    if topic:
        updates = [item for item in updates if item.get("topic", "").lower() == topic.lower()]
    if jurisdiction:
        updates = [
            item
            for item in updates
            if jurisdiction.lower() in item.get("jurisdiction", "").lower()
        ]
    if q:
        needle = q.lower()
        updates = [
            item
            for item in updates
            if needle
            in " ".join(
                [
                    item.get("title", ""),
                    item.get("summary", ""),
                    item.get("business_impact", ""),
                    item.get("source", ""),
                ]
            ).lower()
        ]
    return updates[:limit]


@app.get("/sources")
def get_sources() -> list[dict[str, Any]]:
    sources = load_json(SOURCES_FILE)
    return [
        {
            "name": item.get("name"),
            "jurisdiction": item.get("jurisdiction"),
            "type": item.get("type"),
            "url": item.get("url"),
            "enabled": item.get("enabled", True),
        }
        for item in sources
    ]
