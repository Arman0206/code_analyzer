import { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import Login from "./Login";
import { api } from "./api";
import { useTheme } from "./hooks/useTheme";
import { Logo, Sun, Moon } from "./components/Icons";
import ScoreRing from "./components/ScoreRing";
import IssuesPanel from "./components/IssuesPanel";
import DiffView from "./components/DiffView";
import HistoryPanel from "./components/HistoryPanel";
import { countIssues, LANG_LABEL, MONACO_LANG } from "./lib/issues";

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 14,
  fontFamily: "'JetBrains Mono Variable', ui-monospace, Consolas, monospace",
  scrollBeyondLastLine: false,
  padding: { top: 12, bottom: 12 },
  automaticLayout: true,
  tabSize: 2,
};

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

function Analyzer({ user, onLogout }) {
  const [theme, toggleTheme] = useTheme();
  const [code, setCode] = useState("");
  const [editorLang, setEditorLang] = useState("javascript");
  const [report, setReport] = useState(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("issues");
  const [history, setHistory] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [copied, setCopied] = useState(false);
  const analyzeRef = useRef(null);

  const monacoTheme = theme === "dark" ? "vs-dark" : "vs";

  const loadHistory = useCallback(async () => {
    try {
      const data = await api("/reports");
      setHistory(data.reports || []);
    } catch (err) {
      if (err.status === 401) onLogout();
    }
  }, [onLogout]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  function showReport(next, wasCached = false) {
    setReport(next);
    setCached(wasCached);
    setEditorLang(MONACO_LANG[next.language] || "javascript");
  }

  async function analyze() {
    if (loading || !code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await api("/solve", { method: "POST", body: { codeString: code } });
      showReport(data.report, data.cached);
      setActiveId(data.report.id);
      setTab("issues");
      loadHistory();
    } catch (err) {
      if (err.status === 401) onLogout(); // session expired: back to the login screen
      else setError(err.message); // 400 / 422 / 429 messages come straight from the API
    } finally {
      setLoading(false);
    }
  }

  // The Monaco shortcut is registered once, so it calls through a ref to always run the latest analyze().
  useEffect(() => {
    analyzeRef.current = analyze;
  });

  function handleEditorMount(editor, monaco) {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => analyzeRef.current?.());
  }

  async function openReport(id) {
    setError("");
    try {
      const data = await api(`/reports/${id}`);
      setCode(data.code);
      showReport(data.report);
      setActiveId(id);
      setTab("issues");
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    }
  }

  async function copyFormatted() {
    try {
      await navigator.clipboard.writeText(report.formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy to the clipboard. Select the code and copy it manually.");
    }
  }

  const issueCount = countIssues(report);
  const tabs = [
    { id: "issues", label: "Issues", count: report ? issueCount : null },
    { id: "diff", label: "Diff" },
    { id: "formatted", label: "Formatted code" },
    { id: "history", label: "History", count: history.length || null },
  ];

  function renderPanel() {
    if (tab === "history") return <HistoryPanel items={history} activeId={activeId} onOpen={openReport} />;
    if (!report) {
      if (loading) {
        return (
          <div className="skeleton" aria-hidden="true">
            <span style={{ width: "40%" }} />
            <span style={{ width: "90%" }} />
            <span style={{ width: "75%" }} />
            <span style={{ width: "85%" }} />
          </div>
        );
      }
      return (
        <div className="empty">
          <h3>No analysis yet</h3>
          <p>Paste code on the left, then choose Analyze code. Results appear here.</p>
        </div>
      );
    }
    if (tab === "issues") return <IssuesPanel report={report} />;
    if (tab === "diff") return <DiffView diff={report.diff} />;
    return null; // "formatted" renders its own layout below
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <span>Code Analyzer</span>
        </div>
        <div className="topbar-actions">
          <span className="user-email" title={user.email}>{user.email}</span>
          <button type="button" className="btn btn-ghost btn-icon" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
          <button type="button" className="btn btn-sm" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <main className="workspace">
        <section className="pane" aria-label="Code input">
          <div className="pane-head">
            <h2 className="pane-title">Code</h2>
            <div className="pane-head-actions">
              <span className="chip">{report ? LANG_LABEL[report.language] || report.language : "Language is auto-detected"}</span>
              {code && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCode(""); setReport(null); setActiveId(null); setError(""); }}>
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="editor-wrap">
            {!code && <div className="editor-hint">Paste JavaScript, Python, Java or C++ here</div>}
            <Editor
              height="100%"
              language={editorLang}
              theme={monacoTheme}
              value={code}
              onChange={(val) => setCode(val || "")}
              onMount={handleEditorMount}
              options={EDITOR_OPTIONS}
            />
          </div>
          <div className="pane-foot">
            <span className="hint">
              Run with <kbd>{IS_MAC ? "⌘" : "Ctrl"}</kbd> <kbd>Enter</kbd>
            </span>
            <button type="button" className="btn btn-primary" onClick={analyze} disabled={loading || !code.trim()}>
              {loading && <span className="spinner" aria-hidden="true" />}
              {loading ? "Analyzing" : "Analyze code"}
            </button>
          </div>
        </section>

        <section className="pane pane-results" aria-label="Analysis results" aria-busy={loading}>
          <div className="pane-head">
            <h2 className="pane-title">Review</h2>
            {report && <span className="chip">{cached ? "Cached result, no AI call used" : "Fresh analysis"}</span>}
          </div>
          {loading && <div className="progress" role="progressbar" aria-label="Analyzing your code" />}
          {error && (
            <div className="banner banner-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setError("")}>Dismiss</button>
            </div>
          )}
          {report && report.aiUsed === false && (
            <div className="banner banner-warn" role="status">
              The AI review was unavailable, so these results come from static analysis only.
            </div>
          )}

          {report && (
            <div className="summary">
              <ScoreRing score={report.score} grade={report.grade} />
              <dl className="facts">
                <div className="fact">
                  <dt>Language</dt>
                  <dd>{LANG_LABEL[report.language] || report.language}</dd>
                </div>
                <div className="fact">
                  <dt>Complexity</dt>
                  <dd className="mono">{report.complexity?.cyclomatic ?? "n/a"}</dd>
                </div>
                <div className="fact">
                  <dt>Issues</dt>
                  <dd className="mono">{issueCount}</dd>
                </div>
              </dl>
            </div>
          )}

          <div className="tabs" role="tablist" aria-label="Result sections">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="result-panel"
                className="tab"
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.count ? <span className="count">{t.count}</span> : null}
              </button>
            ))}
          </div>

          {tab === "formatted" && report ? (
            <div className="panel panel-flush" role="tabpanel" id="result-panel" aria-labelledby="tab-formatted">
              <div className="subbar">
                <span className="hint">Read-only</span>
                <button type="button" className="btn btn-sm" onClick={copyFormatted}>{copied ? "Copied" : "Copy code"}</button>
              </div>
              <div className="editor-wrap">
                <Editor
                  height="100%"
                  language={MONACO_LANG[report.language] || "javascript"}
                  theme={monacoTheme}
                  value={report.formatted}
                  options={{ ...EDITOR_OPTIONS, readOnly: true }}
                />
              </div>
            </div>
          ) : (
            <div className="panel" role="tabpanel" id="result-panel" aria-labelledby={`tab-${tab}`}>
              {renderPanel()}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// Auth gate: ask the server "who am I?" once on load, then show Login or the app.
export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = logged out

  useEffect(() => {
    api("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  if (user === undefined) return <div className="boot" role="status">Loading…</div>;
  if (!user) return <Login onLogin={setUser} />;
  return <Analyzer user={user} onLogout={logout} />;
}