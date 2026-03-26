🚀 AI Code Analyzer

An AI-powered full-stack code analysis platform that detects bugs, security vulnerabilities, and code quality issues across multiple programming languages. It combines static analysis with LLM-based insights to provide deep and actionable feedback.

🧠 Features

🔍 Multi-language support (JavaScript, Python, Java, C++)

🧪 Static analysis using AST parsing

🤖 AI-powered code review using Groq LLM

🔐 Sensitive data detection & redaction (API keys, secrets)

📊 Code quality scoring system (bugs, security, complexity, lint)

🧾 Automatic code formatting

🔄 Diff visualization (original vs improved code)

📈 Score history graph




🏗️ Tech Stack
Frontend
React (Vite)
Monaco Editor
Recharts
GSAP
Backend
Node.js
Express
Groq SDK (LLM API)
Acorn (JS AST)
Java Parser



⚙️ How It Works
User inputs code via Monaco Editor
Backend detects language and runs static analysis
Sensitive data is redacted before AI processing
Groq LLM analyzes code for deeper insights
Results are combined into a structured report
Frontend displays:
Bugs & lint issues
Security warnings
Suggestions
Formatted code
Diff output
Score visualization
📦 Installation
1. Clone the repository
git clone https://github.com/Arman0206/code_analyzer.git
cd code_analyzer
2. Setup Backend
cd backend
npm install

Create .env file:

GROQ_API_KEY=your_api_key_here
PORT=8000

Run backend:

node server.js
3. Setup Frontend
cd frontend
npm install
npm run dev
🌐 API Endpoint
POST /solve

Request:

{
  "codeString": "your code here"
}

Response:

{
  "report": {
    "language": "javascript",
    "score": 85,
    "grade": "A",
    "bugs": [],
    "lint": [],
    "security": [],
    "complexity": {},
    "suggestions": [],
    "formatted": "",
    "diff": ""
  }
}
🔐 Security Note
.env files are ignored using .gitignore
API keys are redacted before AI processing
Never expose your API keys publicly
📸 Screenshots (Optional)



🚀 Future Improvements
Support more programming languages
Add real-time collaborative editing
Improve AI suggestions with fine-tuning
Deploy using Docker + cloud


👨‍💻 Author
Arman
GitHub: https://github.com/Arman0206

⭐ Contribute

Feel free to fork this repo, raise issues, and submit PRs!
