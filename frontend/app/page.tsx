"use client";

import { useEffect, useMemo, useState } from "react";
import marketData from "@/data/market.json";

type Status = "RISING" | "WATCH" | "STEADY" | "OPPORTUNITY";
type Topic = {
  code: string;
  name: string;
  description: string;
  status: Status;
  status_label: string;
  score: number;
  trend: number[];
};
type Segment = {
  id: string;
  number: string;
  name: string;
  subtitle: string;
  question: string;
  topics: string[];
};
type Update = {
  id: string;
  title: string;
  source: string;
  url: string;
  published: string;
  jurisdiction: string;
  topic: string;
  importance: number;
  summary: string;
  business_impact: string;
  client_question: string;
};

type View = "overview" | "portfolio" | "segment" | "topic" | "analyst";

const topics = marketData.topics as Topic[];
const segments = marketData.segments as Segment[];
const updates = marketData.updates as Update[];

function statusClass(status: Status) {
  return status.toLowerCase();
}

function Sparkline({ values, status }: { values: number[]; status: Status }) {
  const width = 190;
  const height = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - 6 - ((v - min) / spread) * (height - 12);
      return `${x},${y}`;
    })
    .join(" ");
  const [lastX, lastY] = points.split(" ").at(-1)!.split(",");
  return (
    <svg className={`sparkline ${statusClass(status)}`} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r="3.2" />
    </svg>
  );
}

function StatusPill({ status, label }: { status: Status; label: string }) {
  return <span className={`status-pill ${statusClass(status)}`}>{label}</span>;
}

function TopicCard({ topic, active, onClick }: { topic: Topic; active?: boolean; onClick: () => void }) {
  return (
    <button className={`topic-card ${active ? "active" : ""}`} onClick={onClick}>
      <div className="topic-card-top">
        <span className="ticker-code">{topic.code}</span>
        <StatusPill status={topic.status} label={topic.status_label} />
      </div>
      <div className="topic-name">{topic.name}</div>
      <div className="topic-desc">{topic.description}</div>
      <Sparkline values={topic.trend} status={topic.status} />
    </button>
  );
}

function Brand() {
  return (
    <div className="brand" aria-label="ITAX Market Watch">
      <span className="brand-mark">I</span>
      <strong>ITAX</strong>
      <span>MARKET WATCH</span>
    </div>
  );
}

function Header({ view, setView }: { view: View; setView: (view: View) => void }) {
  const nav: Array<[View, string]> = [
    ["overview", "OPENING BELL"],
    ["portfolio", "MY PORTFOLIO"],
    ["segment", "SECTOR WATCH"],
    ["analyst", "ANALYST NOTE"],
  ];
  return (
    <header className="topbar">
      <Brand />
      <nav className="topnav">
        {nav.map(([key, label]) => (
          <button key={key} className={view === key ? "current" : ""} onClick={() => setView(key)}>
            {label}
          </button>
        ))}
      </nav>
      <span className="concept-badge">CONCEPT EDITION</span>
    </header>
  );
}

function Overview({ onTopic }: { onTopic: (code: string) => void }) {
  return (
    <main className="screen">
      <div className="eyebrow">THE OPENING BELL</div>
      <div className="hero-row">
        <div>
          <h1>Twelve tax signals. <span>One clear view.</span></h1>
          <p className="lead">Track international tax developments as business signals rather than a conventional news feed.</p>
        </div>
        <div className="market-open">MARKET OPEN</div>
      </div>
      <div className="overview-grid">
        {topics.slice(0, 12).map((topic) => (
          <TopicCard key={topic.code} topic={topic} onClick={() => onTopic(topic.code)} />
        ))}
      </div>
      <p className="footer-note">One watchlist for the developments shaping your business.</p>
    </main>
  );
}

function Portfolio({ selected, setSelected, onTopic }: { selected: string[]; setSelected: (value: string[]) => void; onTopic: (code: string) => void }) {
  const toggle = (code: string) => {
    setSelected(selected.includes(code) ? selected.filter((x) => x !== code) : [...selected, code]);
  };
  return (
    <main className="screen portfolio-layout">
      <section className="portfolio-copy">
        <div className="eyebrow">YOUR PORTFOLIO OF PRIORITIES</div>
        <h1>Build your<br /><span>ITAX portfolio.</span></h1>
        <p className="lead">Follow the topics that matter to your operating footprint and client agenda.</p>
        <div className="profile-block"><span>COUNTRIES</span><strong>EU · Netherlands · UK · US · Global</strong></div>
        <div className="profile-block"><span>GROUP</span><strong>Multinational · Digital · Cross-border</strong></div>
        <div className="profile-block"><span>ACTIVITIES</span><strong>Business plans · transactions · reporting</strong></div>
        <div className="profile-block"><span>MY WATCHLIST</span><strong>{selected.length} selected</strong></div>
      </section>
      <section className="portfolio-universe">
        <div className="section-kicker"><span>TOPIC UNIVERSE</span><span>{selected.length} SELECTED</span></div>
        <div className="portfolio-grid">
          {topics.map((topic) => (
            <button key={topic.code} className={`portfolio-topic ${selected.includes(topic.code) ? "selected" : ""}`} onClick={() => toggle(topic.code)} onDoubleClick={() => onTopic(topic.code)}>
              <div><b>{topic.code}</b><span>{topic.name}</span></div>
              <span className="check">{selected.includes(topic.code) ? "✓" : "+"}</span>
            </button>
          ))}
        </div>
        <p className="helper">Click to add/remove. Double-click a topic to open its detail view.</p>
      </section>
    </main>
  );
}

function Diagram({ segmentId }: { segmentId: string }) {
  if (segmentId === "profit-presence") {
    return <div className="diagram chain"><Node label="SUPPLIER" /><Line /><Node label="GROUP COMPANY" accent /><Line /><Node label="CUSTOMER" /><div className="diagram-label">COST CHANGE → MARGIN IMPACT</div></div>;
  }
  if (segmentId === "cash-flow") {
    return <div className="diagram cash"><Node label="PAYER" /><Line /><div className="cash-mid"><span>GROSS PAYMENT</span><div className="withhold-line">↓</div><b>WITHHOLDING</b></div><Line /><Node label="RECIPIENT" /><div className="diagram-label">PAYMENT → TAX → NET CASH</div></div>;
  }
  if (segmentId === "transactions-transparency") {
    return <div className="diagram before-after"><div><span>BEFORE</span><Node label="TARGET" /><Node label="GROUP" /></div><strong>→</strong><div><span>AFTER</span><Node label="PARENT" accent /><div className="mini-nodes"><Node label="A" /><Node label="B" /></div></div></div>;
  }
  return <div className="diagram globe"><Node label="PARENT" /><div className="globe-core"><span>GROUP SCOPE</span><i></i><i></i><i></i></div><div className="right-nodes"><Node label="US OPERATIONS" /><Node label="FOREIGN SUB" /></div><div className="diagram-label">RELIEF · TOP-UP TAX · FILINGS</div></div>;
}

function Node({ label, accent }: { label: string; accent?: boolean }) {
  return <div className={`node ${accent ? "accent" : ""}`}><div className="building">▦</div><span>{label}</span></div>;
}
function Line() { return <div className="line"><i></i><i></i><i></i></div>; }

function SegmentView({ segment, selectedTopic, onSelectTopic }: { segment: Segment; selectedTopic: string; onSelectTopic: (code: string) => void }) {
  const segmentTopics = segment.topics.map((code) => topics.find((t) => t.code === code)!).filter(Boolean);
  const active = segmentTopics.find((t) => t.code === selectedTopic) || segmentTopics[0];
  return (
    <main className="screen segment-screen">
      <div className="segment-title-row">
        <div><div className="eyebrow">MARKET SEGMENT {segment.number} / 04</div><h1>{segment.name}</h1><p className="lead compact">{segment.subtitle}</p></div>
        <span className="stock-count">{segmentTopics.length} TAX STOCKS</span>
      </div>
      <div className="segment-layout">
        <div className="segment-topic-list">
          {segmentTopics.map((topic) => <TopicCard key={topic.code} topic={topic} active={active.code === topic.code} onClick={() => onSelectTopic(topic.code)} />)}
        </div>
        <section className="diagram-panel">
          <div className="diagram-title">{active.name.toUpperCase()} · BUSINESS MODEL VIEW</div>
          <Diagram segmentId={segment.id} />
        </section>
      </div>
      <div className="business-question"><span>THE BUSINESS QUESTION</span><h2>{segment.question}</h2></div>
    </main>
  );
}

function TopicView({ topic, onAnalyst }: { topic: Topic; onAnalyst: (update?: Update) => void }) {
  const topicUpdates = updates.filter((u) => u.topic === topic.code);
  const relevant = topicUpdates.length ? topicUpdates : updates.filter((u) => ["P2", "VAT", "DEAL"].includes(u.topic)).slice(0, 3);
  return (
    <main className="screen topic-detail-screen">
      <div className="topic-detail-head">
        <div><div className="eyebrow">TAX STOCK / {topic.code}</div><h1>{topic.name}</h1><p className="lead compact">{topic.description}</p></div>
        <div className="score-box"><StatusPill status={topic.status} label={topic.status_label} /><strong>{topic.score}</strong><span>MOMENTUM</span></div>
      </div>
      <section className="topic-hero-grid">
        <div className="trend-panel"><span>90-DAY SIGNAL</span><Sparkline values={topic.trend} status={topic.status} /><div className="trend-scale"><small>PREVIOUS</small><small>NOW</small></div></div>
        <div className="topic-question"><span>WHY IT MATTERS</span><h2>{relevant[0]?.client_question || "What should businesses review next?"}</h2><p>{relevant[0]?.business_impact || "Monitor material regulatory change and translate it into business actions."}</p></div>
      </section>
      <div className="updates-head"><span>LATEST DEVELOPMENTS</span><span>{relevant.length} SIGNALS</span></div>
      <div className="updates-list">
        {relevant.map((item) => (
          <article className="update-card" key={item.id}>
            <div className="update-meta"><span>{item.source}</span><span>{item.jurisdiction}</span><span>{item.published}</span><span className="importance">{item.importance}</span></div>
            <h3>{item.title}</h3><p>{item.summary}</p>
            <div className="update-actions"><a href={item.url} target="_blank" rel="noreferrer">OPEN SOURCE ↗</a><button onClick={() => onAnalyst(item)}>CREATE ANALYST NOTE</button></div>
          </article>
        ))}
      </div>
    </main>
  );
}

function AnalystView({ update, agenda, addAgenda }: { update?: Update; agenda: string[]; addAgenda: (id: string) => void }) {
  const item = update || updates[0];
  const topic = topics.find((t) => t.code === item.topic) || topics[0];
  const added = agenda.includes(item.id);
  return (
    <main className="screen analyst-screen">
      <div className="eyebrow amber">MARKET MOVER / CLIENT SCENARIO</div>
      <h1>A moving signal. <span>A useful conversation.</span></h1>
      <div className="analyst-layout">
        <section className="signal-card">
          <div className="signal-head"><b>{topic.code}</b><StatusPill status={topic.status} label="ATTENTION UP" /></div>
          <h2>{topic.name}</h2><span>ILLUSTRATIVE PRIORITY TREND</span><Sparkline values={topic.trend} status={topic.status} />
          <div className="trend-scale"><small>PREVIOUS EDITION</small><small>NOW</small></div>
        </section>
        <section className="analyst-note">
          <div className="note-kicker">ITAX ANALYST NOTE</div>
          <h2>{topic.name}</h2>
          <label>WHAT CHANGED</label><strong>{item.title}</strong>
          <label>OUR EXPOSURE</label><strong>{item.business_impact}</strong>
          <label>QUESTION FOR THE CLIENT</label><strong>{item.client_question}</strong>
          <div className="note-source">Basis: {item.source} · {item.published} · {item.jurisdiction}</div>
          <button className={added ? "agenda added" : "agenda"} onClick={() => addAgenda(item.id)}>{added ? "✓ ADDED TO MEETING AGENDA" : "ADD TO MEETING AGENDA"}</button>
        </section>
      </div>
      <section className="next-conversation">
        <div><span>NEXT CONVERSATION</span><h2>{topic.name} is on the agenda.</h2></div>
        <div className="question-box"><span>YOUR QUESTION</span><strong>{item.client_question}</strong><b>✓</b></div>
        <div className="conversation-meta"><div><span>OWNER</span><b>Client finance + Tax</b></div><div><span>FOLLOW-UP</span><b>Next review</b></div></div>
      </section>
    </main>
  );
}

function BottomTicker({ onTopic }: { onTopic: (code: string) => void }) {
  return (
    <footer className="bottom-ticker">
      <div className="ticker-track">
        {[...topics, ...topics].map((topic, idx) => (
          <button key={`${topic.code}-${idx}`} onClick={() => onTopic(topic.code)}><b>{topic.code}</b><span className={statusClass(topic.status)}>{topic.status_label}</span><i>{topic.status === "RISING" || topic.status === "OPPORTUNITY" ? "▲" : topic.status === "WATCH" ? "–" : "·"}</i></button>
        ))}
      </div>
      <div className="ticker-caption">ILLUSTRATIVE PRIORITY MOVEMENTS · INTERNATIONAL TAX</div>
    </footer>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [selectedSegmentId, setSelectedSegmentId] = useState(segments[0].id);
  const [selectedTopic, setSelectedTopic] = useState("P2");
  const [selectedPortfolio, setSelectedPortfolio] = useState<string[]>(["P2", "TP", "WHT", "VAT", "DAC", "MAP"]);
  const [analystUpdate, setAnalystUpdate] = useState<Update | undefined>(updates[0]);
  const [agenda, setAgenda] = useState<string[]>([]);

  useEffect(() => {
    const savedPortfolio = localStorage.getItem("itax-portfolio");
    const savedAgenda = localStorage.getItem("itax-agenda");
    if (savedPortfolio) setSelectedPortfolio(JSON.parse(savedPortfolio));
    if (savedAgenda) setAgenda(JSON.parse(savedAgenda));
  }, []);

  const updatePortfolio = (value: string[]) => {
    setSelectedPortfolio(value);
    localStorage.setItem("itax-portfolio", JSON.stringify(value));
  };
  const addAgenda = (id: string) => {
    const next = agenda.includes(id) ? agenda.filter((x) => x !== id) : [...agenda, id];
    setAgenda(next);
    localStorage.setItem("itax-agenda", JSON.stringify(next));
  };
  const openTopic = (code: string) => {
    setSelectedTopic(code);
    setView("topic");
  };
  const openAnalyst = (update?: Update) => {
    if (update) setAnalystUpdate(update);
    setView("analyst");
  };

  const currentSegment = useMemo(() => segments.find((s) => s.id === selectedSegmentId) || segments[0], [selectedSegmentId]);
  const currentTopic = useMemo(() => topics.find((t) => t.code === selectedTopic) || topics[0], [selectedTopic]);

  return (
    <div className="app-shell">
      <div className="grid-overlay" />
      <Header view={view} setView={setView} />
      {view === "overview" && <Overview onTopic={openTopic} />}
      {view === "portfolio" && <Portfolio selected={selectedPortfolio} setSelected={updatePortfolio} onTopic={openTopic} />}
      {view === "segment" && (
        <>
          <div className="segment-tabs">{segments.map((s) => <button key={s.id} className={s.id === selectedSegmentId ? "active" : ""} onClick={() => { setSelectedSegmentId(s.id); setSelectedTopic(s.topics[0]); }}>{s.number} {s.name}</button>)}</div>
          <SegmentView segment={currentSegment} selectedTopic={selectedTopic} onSelectTopic={setSelectedTopic} />
        </>
      )}
      {view === "topic" && <TopicView topic={currentTopic} onAnalyst={openAnalyst} />}
      {view === "analyst" && <AnalystView update={analystUpdate} agenda={agenda} addAgenda={addAgenda} />}
      <BottomTicker onTopic={openTopic} />
    </div>
  );
}
