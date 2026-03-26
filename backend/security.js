function redactAndDetect(code) {
  const rules = [
    { type: 'API Key', regex: /AIza[0-9A-Za-z-_]{35}/g },
    { type: 'Dangerous Eval', regex: /\beval\s*\(/g },
    { type: 'Command Injection', regex: /os\.system\s*\(/g },
    { type: 'Hardcoded Secret', regex: /(password|secret|key)\s*=\s*['"][^'"]+['"]/gi }
  ];
  let cleanCode = code;
  let detections = [];
  const lines = code.split('\n');
  
  rules.forEach(rule => {
    lines.forEach((lineContent, index) => {
      if (lineContent.match(rule.regex)) {
        detections.push({ type: rule.type, line: index + 1, raw: lineContent.trim() });
      }
    });
    cleanCode = cleanCode.replace(rule.regex, "[REDACTED_SENSITIVE_DATA]");
  });
  return { cleanCode, detections };
}
module.exports = { redactAndDetect };