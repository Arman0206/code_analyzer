const rules = [
  { type: "Google API Key", regex: /AIza[0-9A-Za-z_-]{35}/g },
  { type: "Groq API Key", regex: /gsk_[A-Za-z0-9]{20,}/g },
  { type: "OpenAI-style Key", regex: /sk-[A-Za-z0-9_-]{20,}/g },
  { type: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/g },
  { type: "GitHub Token", regex: /gh[pousr]_[A-Za-z0-9]{36,}/g },
  { type: "Private Key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { type: "Dangerous Eval", regex: /\beval\s*\(/g },
  { type: "Command Injection", regex: /\bos\.system\s*\(/g },
  { type: "Hardcoded Secret", regex: /\b(password|passwd|secret|api_?key|token)\s*[:=]\s*['"][^'"]+['"]/gi },
];

function redactAndDetect(code) {
  let cleanCode = code;
  const detections = [];
  const lines = code.split("\n");
  for (const rule of rules) {
    lines.forEach((line, i) => {
      rule.regex.lastIndex = 0; // /g regexes are stateful, so reset before each test
      if (rule.regex.test(line)) detections.push({ type: rule.type, line: i + 1 });
    });
    cleanCode = cleanCode.replace(rule.regex, "[REDACTED_SENSITIVE_DATA]");
  }
  return { cleanCode, detections };
}
module.exports = { redactAndDetect };