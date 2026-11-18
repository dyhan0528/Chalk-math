// 칠판 수학 — 해설 문장 → AI 목소리 (Vercel 서버 함수)
// 서버에 GEMINI_API_KEY 또는 OPENAI_API_KEY가 있으면, 학생 휴대폰에서도 키 없이 자연스러운 목소리로 들을 수 있어요.
//
// 환경 변수 (선택)
//   TTS_PROVIDER   gemini | openai  (둘 다 있을 때 고르기, 기본 gemini)
//   TTS_OFF        1로 두면 서버 목소리를 끄고 기기 목소리만 써요 (사용량을 아끼고 싶을 때)

const GEM_TTS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];
const OAI_TTS_INSTR = "Speak natural Korean like a warm, friendly middle-school math teacher explaining a problem step by step to one student. Calm, clear and encouraging, with natural pauses.";
let gemModel = process.env.GEMINI_TTS_MODEL || "";

// 앱 파일(휴대폰에서 파일로 연 것)과 이 사이트에서 온 요청을 받아요. 다른 사이트를 더 허용하려면 ALLOWED_ORIGINS에 쉼표로 적어요.
function allowCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  const extra = String(process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  let sameSite = false;
  try { sameSite = new URL(origin).host === host; } catch (e) {}
  if (origin === "null" || sameSite || extra.includes(origin) || extra.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.setHeader("Access-Control-Max-Age", "86400");
    return true;
  }
  return false;
}

function pick() {
  if (process.env.TTS_OFF) return null;
  const gem = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY, oai = process.env.OPENAI_API_KEY;
  const want = String(process.env.TTS_PROVIDER || "").toLowerCase();
  if (want === "openai" && oai) return "openai";
  if (want === "gemini" && gem) return "gemini";
  return gem ? "gemini" : oai ? "openai" : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const corsOk = allowCors(req, res);
  if (req.method === "OPTIONS") return res.status(corsOk ? 204 : 403).end();
  if (!corsOk) return res.status(403).json({ ok: false, error: "이 앱 밖에서는 쓸 수 없어요." });
  const provider = pick();
  if (req.method === "GET") return res.status(200).json({ ok: !!provider, provider });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST로만 요청해 주세요." });
  if (!provider) return res.status(500).json({ ok: false, error: "서버에 목소리용 키(GEMINI_API_KEY 또는 OPENAI_API_KEY)가 없어요." });


  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const text = String(body.text || "").trim().slice(0, 500);
  if (!text) return res.status(400).json({ ok: false, error: "읽을 문장이 없어요." });
  const voice = /^[A-Za-z]{2,24}$/.test(String(body.voice || "")) ? String(body.voice) : (provider === "openai" ? "coral" : "Sulafat");

  try {
    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts", voice, input: text, instructions: OAI_TTS_INSTR, response_format: "mp3" }),
        signal: AbortSignal.timeout(55000)
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); return res.status(r.status === 429 ? 429 : 502).json({ ok: false, error: (j.error && j.error.message) || `OpenAI 오류 ${r.status}` }); }
      res.setHeader("content-type", "audio/mpeg");
      return res.status(200).send(Buffer.from(await r.arrayBuffer()));
    }

    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const models = gemModel ? [gemModel, ...GEM_TTS.filter(m => m !== gemModel)] : GEM_TTS;
    let lastStatus = 502, lastMsg = "";
    for (const m of models) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
        signal: AbortSignal.timeout(55000)
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        const parts = ((((j.candidates || [])[0] || {}).content) || {}).parts || [];
        const inl = parts.map(p => p.inlineData || p.inline_data).find(x => x && x.data);
        if (inl) {
          gemModel = m;
          const mime = inl.mimeType || inl.mime_type || "";
          let buf = Buffer.from(inl.data, "base64");
          const isWav = /wav/i.test(mime) || buf.slice(0, 4).toString() === "RIFF";
          if (!isWav) { const rate = Number((/rate=(\d+)/i.exec(mime) || [])[1]) || 24000; buf = Buffer.concat([wavHeader(buf.length, rate), buf]); }
          res.setHeader("content-type", "audio/wav");
          return res.status(200).send(buf);
        }
        lastMsg = "빈 음성이 왔어요"; continue;
      }
      lastStatus = r.status; lastMsg = (j.error && j.error.message) || `Gemini 오류 ${r.status}`;
      if (r.status === 401 || r.status === 403 || r.status === 429 || (r.status === 400 && /api key/i.test(lastMsg))) break;
    }
    return res.status(lastStatus === 429 ? 429 : lastStatus === 401 || lastStatus === 403 ? 401 : 502).json({ ok: false, error: lastMsg });
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message || "목소리를 만들지 못했어요." });
  }
}

function wavHeader(len, rate) {
  const b = Buffer.alloc(44);
  b.write("RIFF", 0); b.writeUInt32LE(36 + len, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(len, 40);
  return b;
}
