"use strict";

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch"); // важно для node-fetch@2
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// ===== ENV =====
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

// ===== DB (можно оставить даже если БД пока не подключена) =====
let pool = null;
if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
}

// ===== PROMPT =====
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
`.trim();

// Функция extractOutputText больше не нужна, используем стандартный формат OpenAI API

// ===== ROUTES =====
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/db-test", async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ ok: false, error: "DATABASE_URL is not set" });
    const r = await pool.query("SELECT NOW()");
    res.json({ ok: true, time: r.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/npc", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
    }

    const prompt = req.body?.prompt;
    if (!prompt) return res.status(400).json({ error: "no prompt" });

    // контекст сделки (не обязателен)
    const car = req.body?.car ?? null;
    const npcAsk = req.body?.npcAsk ?? null;
    const npcMin = req.body?.npcMin ?? null;
    const playerOffer = req.body?.playerOffer ?? null;

    let context = "";
    if (car || npcAsk !== null || npcMin !== null || playerOffer !== null) {
      context = `КОНТЕКСТ СДЕЛКИ:
Машина: ${car ? JSON.stringify(car) : "нет данных"}
Цена продавца (NPC): ${npcAsk ?? "нет"}
Минимум NPC: ${npcMin ?? "нет"}
Предложение игрока: ${playerOffer ?? "нет"}
`;
    }

    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${context}\nСообщение игрока: ${prompt}` },
      ],
      temperature: 0.9,
      max_tokens: 220,
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || "OpenAI error",
        raw: data,
      });
    }

    const text = data?.choices?.[0]?.message?.content || "(пустой ответ)";
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Proxy running on port", PORT));