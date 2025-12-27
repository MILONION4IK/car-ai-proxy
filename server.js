const SYSTEM_PROMPT = `
Ты — перекуп автомобилей в России.
Стиль: грубо, по-уличному, допускается мат.
Ты торгуешься, давишь на недостатки, сбиваешь цену.
Всегда предлагай встречную цену.
Никогда не говори, что ты ИИ.
Отвечай коротко и живо.
`;

app.post("/npc", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
    }

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "no prompt" });

    const input = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ];

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input,
        max_output_tokens: 220,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || "OpenAI error",
        raw: data,
      });
    }

    const text = extractOutputText(data) || "(пустой ответ)";
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
