import React, { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Editor from "@monaco-editor/react";

export default function App() {
  const input = useRef(null);
  const output = useRef(null);
  const welcome_ref = useRef(null);
  const coverref = useRef(null);
  const loadref = useRef(null);

  useEffect(() => {
    if (welcome_ref.current && coverref.current) {
      let t = gsap.timeline();
      t.to(welcome_ref.current, { y: 14, opacity: 1, duration: 0.5 });
      t.to(welcome_ref.current, { y: 0, delay: 1.2, opacity: 0, duration: 0.8 });
      t.to(coverref.current, { opacity: 0, duration: 1, delay: -0.2 });
      t.to(coverref.current, { display: "none", delay: -0.25 });
    }
  }, []);

  const [lang, setLang] = useState("javascript");
  const [score, setScore] = useState(0);
  const [grade, setGrade] = useState("");
  const [complexity, setComplexity] = useState("");
  const [formatted_code, setFormattedCode] = useState("");
  const [bugs, setBugs] = useState([]);
  const [codeval, setCodeVal] = useState("// Paste your code here...\n");
  const [redundant, setRedundant] = useState([]);
  const [security, setSecurity] = useState([]);
  const [scorelist, setScoreList] = useState([]);
  const [lint, setLint] = useState([]);
  const [diff, setDiff] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  async function sendRequest() {
    try {
      if (loadref.current) {
        gsap.set(loadref.current, { display: "flex" });
        gsap.fromTo(loadref.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
      }
      const response = await fetch("http://localhost:8000/solve", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codeString: codeval })
      });
      const data = await response.json();
      if (response.ok) {
        setLang(data.report.language); 
        setScore(data.report.score); 
        setGrade(data.report.grade);
        setFormattedCode(data.report.formatted); 
        setBugs(data.report.bugs || []); 
        setLint(data.report.lint || []);
        setSecurity(data.report.security || []); 
        setComplexity(data.report.complexity || ""); 
        setRedundant(data.report.redundancy || []);
        setSuggestions(data.report.suggestions || []); 
        setDiff(data.report.diff || "");
        setScoreList(prev => [...prev, data.report.score]);
      } else {
        alert(data.error || "Something went wrong");
      }
    } catch (err) { 
      console.error(err);
        alert("Server error. Is the backend running?");
    } finally {
      if (loadref.current) {
        gsap.to(loadref.current, { opacity: 0, duration: 0.4, onComplete: () => gsap.set(loadref.current, { display: "none" }) });
      }
    }
  }

  const getMonacoLanguage = (detectedLang) => {
    const map = { cpp: "cpp", java: "java", python: "python", javascript: "javascript" };
    return map[detectedLang] || "javascript";
  };

  return (
    <>
      <div id="loader" ref={loadref}><div id="circle"></div></div>
      <div id="cover" ref={coverref}><h1 ref={welcome_ref}>welcome</h1></div>
      <div id="main">
        <div id="combine">
          <div id="input_box" ref={input}>
            <h1>paste your code below</h1>
            <div id="texty">
              <div style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid var(--border)", marginBottom: "10px" }}>
                <Editor height="450px" language="javascript" theme="vs-dark" value={codeval} onChange={(val) => setCodeVal(val || "")} options={{ minimap: { enabled: false }, fontSize: 14 }} />
              </div>
              <div id="arrange"><button type="button" id="give_code" onClick={sendRequest}>Submit</button></div>
            </div>
          </div>
          <div id="graph_box">
            <h2>Score History</h2>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={scorelist.map((v, i) => ({ sub: i + 1, score: v }))} margin={{ top: 20, right: 30, left: 40, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="sub" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: "#1f2330", border: "none", borderRadius: "8px" }} />
                <Line type="monotone" dataKey="score" stroke="#818cf8" strokeWidth={3} dot={{ r: 5, fill: "#818cf8" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div id="output_box" ref={output}>
          <h1>Code review</h1>
          <div id="output_fields">
            <h3>language : {lang}</h3><h3>score : {score}</h3><h3>grade : {grade}</h3><h3>complexity : {complexity.cyclomatic || complexity}</h3>
            <h3>bugs : </h3><div className="suggest">{bugs.length === 0 ? <p>No Bugs</p> : bugs.map((val, idx) => <li key={idx}>{val.message || val}</li>)}</div>
            <h3>lint :</h3><div className="suggest">{lint.length === 0 ? <p>No lint</p> : lint.map((val, idx) => <li key={idx}>{val.message || val}</li>)}</div>
            <h3>security : </h3><div className="suggest">{security.length === 0 ? <p>No Security issues</p> : security.map((val, idx) => <li key={idx}>{val}</li>)}</div>
            <h3>redundancy : </h3><div className="suggest">{redundant.length === 0 ? <p>No Redundancy</p> : redundant.map((val, idx) => <li key={idx}>{val}</li>)}</div>
            <h3>suggestions :</h3><div className="suggest">{suggestions.length === 0 ? <p>No suggestions</p> : suggestions.map((val, idx) => <li key={idx}>Line : {val.line}, Fix : {val.fix}</li>)}</div>
            <h3 style={{marginTop: "20px"}}>diff :</h3><div className="suggest" style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "12px", color: "#d1d5db" }}>{diff || "No diff generated."}</div>
            <h3 style={{marginTop: "20px"}}>formatted version of code : </h3>
            <div style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid var(--border)" }}>
              <Editor height="400px" language={getMonacoLanguage(lang)} theme="vs-dark" value={formatted_code} options={{ readOnly: true, minimap: { enabled: false }, fontSize: 14 }} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}