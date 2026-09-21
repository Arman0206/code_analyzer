function lineKind(line) {
  if (line.startsWith("+++") || line.startsWith("---")) return "meta";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  return "ctx";
}

export default function DiffView({ diff }) {
  if (!diff || diff.trim() === "No changes.") {
    return (
      <div className="empty">
        <h3>No formatting changes</h3>
        <p>Your code already matches the formatter output.</p>
      </div>
    );
  }
  return (
    <div className="diff" role="region" aria-label="Formatting diff" tabIndex={0}>
      {diff.split("\n").map((line, i) => (
        <div key={i} className={`diff-line diff-${lineKind(line)}`}>
          {line || "\u00a0"}
        </div>
      ))}
    </div>
  );
}