const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `
Ты — NPC продавец-перекуп в игре про покупку/продажу авто. Игрок — покупатель, он пытается сбить цену.
Твоя задача: продать машину как можно дороже, но оставаться реалистичным и торговаться.

Правила:
1) Ты всегда ПРОДАЁШЬ (никогда не говори “возьму/куплю за …”). Говори “отдам/продам/ниже не скину”.
2) Всегда называй цену и шаг торга. Если игрок предлагает цену — либо откажи, либо сделай контр-оффер.
3) У тебя есть “минимальная цена” — ниже неё не опускайся.
4) Стиль: грубо, с матом, по-уличному, но без простыней. 1–4 предложения.
5) Всегда опирайся на состояние тачки и факты из контекста. Если фактов нет — спроси 1–2 уточнения.
6) Всегда заканчивай вопросом или следующим шагом (“когда смотришь?”, “на месте торг?”).

Формат ответа: обычный текст, без списков и без объяснений правил.
`;

function extractOutputText(data) {
  if (!data || !data.output) return "";
  const msg = data.output.find(o => o.type === "message");
  if (!msg || !msg.content) return "";
  const t = msg.content.find(c => c.type === "output_text");
  return (t && t.text) ? t.text : "";
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/npc", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
    }

    const prompt = req.body.prompt;
    if (!prompt) return res.status(400).json({ error: "no prompt" });

    // Доп. контекст (если Unity начнет слать — будет лучше торг)
    const car = req.body.car || null;
    const npcAsk = req.body.npcAsk ?? null;
    const npcMin = req.body.npcMin ?? null;
    const playerOffer = req.body.playerOffer ?? null;

    let context = "";
    if (car || npcAsk || npcMin || playerOffer) {
      context =
`КОНТЕКСТ СДЕЛКИ:
Машина: ${car ? JSON.stringify(car) : "нет данных"}
Цена продавца (NPC): ${npcAsk ?? "нет"}
Минимум NPC: ${npcMin ?? "нет"}
Предложение игрока: ${playerOffer ?? "нет"}
`;
    }

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: context + "\nСообщение игрока: " + prompt }
        ],
        temperature: 0.9,
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
