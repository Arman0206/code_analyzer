import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { LANG_LABEL } from "../lib/issues";

const formatDate = (iso) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export default function HistoryPanel({ items, activeId, onOpen }) {
  if (items.length === 0) {
    return (
      <div className="empty">
        <h3>No history yet</h3>
        <p>Every analysis you run is saved here, so you can reopen it later.</p>
      </div>
    );
  }

  // The API returns newest first; the chart reads left to right in time.
  const series = [...items].reverse().map((r, i) => ({ run: i + 1, score: r.score }));
  const tick = { fill: "var(--muted)", fontSize: 12 };

  return (
    <>
      <div className="chart" role="img" aria-label="Score for each of your analyses over time">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="run" tick={tick} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={tick} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--ink)" }}
              labelFormatter={(n) => `Run ${n}`}
            />
            <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: "var(--accent)" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="history-list">
        {items.map((r) => (
          <li key={r.id}>
            <button type="button" className="history-item" aria-current={r.id === activeId ? "true" : undefined} onClick={() => onOpen(r.id)}>
              <span className="score-badge">{Math.round(r.score)}</span>
              <span className="grow">{LANG_LABEL[r.language] || r.language}</span>
              <span className="hint">{formatDate(r.created_at)}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}