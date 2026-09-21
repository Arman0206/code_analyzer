// The backend returns issues as plain strings or as objects ({ message, rule, line, ... }).
// These helpers turn both into one shape so the UI has a single code path.
export const ISSUE_SECTIONS = [
  { key: "security", title: "Security", tone: "danger" },
  { key: "bugs", title: "Bugs", tone: "warn" },
  { key: "lint", title: "Lint", tone: "info" },
  { key: "redundancy", title: "Redundancy", tone: "violet" },
  { key: "suggestions", title: "Suggested fixes", tone: "good" },
];

export function normalizeIssue(item) {
  if (typeof item === "string") return { text: item };
  return {
    text: item.message || item.fix || JSON.stringify(item),
    tag: item.rule || item.type,
    line: item.line || undefined,
  };
}

export function countIssues(report) {
  if (!report) return 0;
  // Suggested fixes are advice, not problems, so they don't count as issues.
  return ["security", "bugs", "lint", "redundancy"].reduce((sum, key) => sum + (report[key]?.length || 0), 0);
}

export const LANG_LABEL = { javascript: "JavaScript", python: "Python", java: "Java", cpp: "C++" };
export const MONACO_LANG = { javascript: "javascript", python: "python", java: "java", cpp: "cpp" };