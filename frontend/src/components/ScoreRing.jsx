export default function ScoreRing({ score = 0, grade = "", size = 88 }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const tone = pct >= 85 ? "good" : pct >= 70 ? "warn" : "bad";
  const center = size / 2;

  return (
    <div className={`ring ring-${tone}`} style={{ width: size, height: size }} role="img" aria-label={`Score ${Math.round(pct)} out of 100, grade ${grade}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={center} cy={center} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-value"
          cx={center}
          cy={center}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="ring-label">
        <strong>{Math.round(pct)}</strong>
        <span>Grade {grade}</span>
      </div>
    </div>
  );
}