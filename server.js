const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function extractOutputText(data) {
  if (!data || !data.output) return "";
  const msg = data.output.find(o => o.type === "message");
  if (!msg || !msg.content) return "";
  const t = msg.content.find(c => c.type === "output_text");
  return (t && t.text) ? t.text : "";
}

app.post("/npc", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
    }

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "no prompt" });

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
        max_output_tokens: 220
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || "OpenAI error",
        raw: data
      });
    }

    const text = extractOutputText(data) || "(пустой ответ)";
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Proxy running on port", PORT));