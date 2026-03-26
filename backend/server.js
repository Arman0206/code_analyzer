require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { analyze } = require("./index.js"); 

const app = express();

// FIX 1: Allow traffic from Vite's port (5173)
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// FIX 2: Match the route name your frontend is calling
app.post("/solve", async (req, res) => {
    try {
        const { codeString } = req.body;
        if (!codeString || codeString.trim() === "") return res.status(400).json({ error: "Empty code" });
        const report = await analyze(codeString);
        res.status(200).json({ report });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Analysis error", details: error.message });
    }
});

app.listen(8000, () => console.log(`🚀 Backend running on port 8000`));