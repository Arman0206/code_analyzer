import { ISSUE_SECTIONS, normalizeIssue, countIssues } from "../lib/issues";

export default function IssuesPanel({ report }) {
  const groups = ISSUE_SECTIONS.map((s) => ({ ...s, items: (report[s.key] || []).map(normalizeIssue) })).filter(
    (g) => g.items.length > 0
  );

  if (groups.length === 0) {
    return (
      <div className="empty">
        <h3>No issues found</h3>
        <p>Static analysis and the AI review found nothing to fix in this code.</p>
      </div>
    );
  }

  return (
    <>
      <p className="hint issues-lead">
        {countIssues(report)} {countIssues(report) === 1 ? "issue" : "issues"} found
      </p>
      {groups.map((g) => (
        <section className="issue-group" key={g.key}>
          <h3 className="group-title">
            <span className={`dot dot-${g.tone}`} aria-hidden="true" />
            {g.title}
            <span className="count">{g.items.length}</span>
          </h3>
          <ul className="issues">
            {g.items.map((it, i) => (
              <li key={i}>
                <span className="issue-text">{it.text}</span>
                {it.line ? <span className="issue-meta">Line {it.line}</span> : null}
                {it.tag ? <span className="issue-meta">{it.tag}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}