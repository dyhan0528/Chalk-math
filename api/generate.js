// 칠판 수학 — 문제 사진/글 → 강의 대본(JSON)
// Vercel 서버 함수. API 키는 Vercel 환경 변수에만 두고, 앱(브라우저)에는 절대 보내지 않아요.
//
// 환경 변수 (셋 중 하나만 있으면 돼요)
//   GEMINI_API_KEY     구글 Gemini   (모델 바꾸기: GEMINI_MODEL,    기본 gemini-flash-latest)
//   OPENAI_API_KEY     OpenAI        (모델 바꾸기: OPENAI_MODEL,    기본 gpt-5.6-terra)
//   ANTHROPIC_API_KEY  Claude API    (모델 바꾸기: ANTHROPIC_MODEL, 기본 claude-sonnet-5-5)
//   AI_PROVIDER        키가 여러 개일 때 쓸 것: gemini | openai | anthropic
//   APP_PASSCODE       (선택) 넣으면 이 비밀번호를 아는 사람만 새 강의를 만들 수 있어요

const PROVIDERS = {
  gemini: {
    label: "Google Gemini",
    key: () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    model: () => process.env.GEMINI_MODEL || "gemini-flash-latest",
    call: callGemini
  },
  openai: {
    label: "OpenAI",
    key: () => process.env.OPENAI_API_KEY,
    model: () => process.env.OPENAI_MODEL || "gpt-5.6-terra",
    call: callOpenAI
  },
  anthropic: {
    label: "Claude API",
    key: () => process.env.ANTHROPIC_API_KEY,
    model: () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
    call: callAnthropic
  }
};

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

function pickProvider() {
  const want = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (want && PROVIDERS[want] && PROVIDERS[want].key()) return want;
  return ["gemini", "openai", "anthropic"].find(p => PROVIDERS[p].key()) || null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const corsOk = allowCors(req, res);
  if (req.method === "OPTIONS") return res.status(corsOk ? 204 : 403).end();
  if (!corsOk) return res.status(403).json({ ok: false, error: "이 앱 밖에서는 쓸 수 없어요." });
  const p = pickProvider();
  const needPasscode = !!process.env.APP_PASSCODE;

  if (req.method === "GET") {
    return res.status(200).json({ ok: !!p, provider: p ? PROVIDERS[p].label : null, model: p ? PROVIDERS[p].model() : null, needPasscode });
  }
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST로만 요청해 주세요." });
  if (!p) {
    return res.status(500).json({ ok: false, code: "no_key", error: "서버에 AI API 키가 없어요. Vercel 프로젝트 설정의 환경 변수에 GEMINI_API_KEY(또는 OPENAI_API_KEY, ANTHROPIC_API_KEY)를 넣고 다시 배포해 주세요." });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  if (needPasscode && String(body.passcode || "") !== String(process.env.APP_PASSCODE)) {
    return res.status(401).json({ ok: false, code: "passcode", error: "비밀번호가 맞지 않아요." });
  }

  const text = String(body.text || "").slice(0, 2000).trim();
  const memo = String(body.memo || "").slice(0, 300).trim();
  let img = null;
  if (body.image) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image));
    if (!m) return res.status(400).json({ ok: false, error: "사진 형식을 읽지 못했어요. 다른 사진으로 해 주세요." });
    if (m[2].length > 7000000) return res.status(413).json({ ok: false, error: "사진이 너무 커요." });
    img = { mime: m[1], data: m[2] };
  }
  if (!img && !text) return res.status(400).json({ ok: false, error: "문제 사진이나 문제 글이 필요해요." });

  const prov = PROVIDERS[p];
  const model = prov.model();
  try {
    const out = await prov.call(prov.key(), model, buildPrompt(text, memo, !!img), img);
    return res.status(200).json({ ok: true, text: out, provider: prov.label, model });
  } catch (e) {
    return res.status(502).json({ ok: false, code: e.code || "api_error", error: friendly(e, prov.label, model, p) });
  }
}

function friendly(e, label, model, p) {
  const s = e.status || 0;
  const envModel = { gemini: "GEMINI_MODEL", openai: "OPENAI_MODEL", anthropic: "ANTHROPIC_MODEL" }[p];
  if (s === 401 || s === 403) return `${label} API 키가 맞지 않거나 권한이 없어요. Vercel 환경 변수의 키를 확인해 주세요.`;
  if (s === 404) return `${label}에서 모델 '${model}'을 찾지 못했어요. 환경 변수 ${envModel}에 지금 쓸 수 있는 모델 이름을 넣어 주세요.`;
  if (s === 429) return `${label} 사용량 한도에 걸렸어요. 잠시 뒤 다시 해 보거나, 요금제·무료 한도를 확인해 주세요.`;
  if (s === 400 && /image|size|large/i.test(e.message || "")) return "사진을 AI가 받지 못했어요. 문제 부분만 잘라서 다시 올려 주세요.";
  if (e.name === "TimeoutError" || e.name === "AbortError") return "AI 답이 너무 오래 걸렸어요. 다시 한 번 눌러 주세요.";
  return `${label} 오류: ${e.message || "알 수 없는 오류"}`;
}

function apiError(status, message) { const e = new Error(message || `HTTP ${status}`); e.status = status; return e; }
const TIMEOUT = () => AbortSignal.timeout(285000);

async function callGemini(key, model, prompt, img) {
  const parts = [];
  if (img) parts.push({ inlineData: { mimeType: img.mime, data: img.data } });
  parts.push({ text: prompt });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 32768 } }),
    signal: TIMEOUT()
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw apiError(r.status, j.error && j.error.message);
  const cand = (j.candidates || [])[0] || {};
  const out = ((cand.content && cand.content.parts) || []).filter(x => typeof x.text === "string" && !x.thought).map(x => x.text).join("");
  if (!out) throw apiError(500, "빈 답이 왔어요 (" + (cand.finishReason || (j.promptFeedback && j.promptFeedback.blockReason) || "이유 모름") + ")");
  return out;
}

async function callOpenAI(key, model, prompt, img) {
  const content = [{ type: "input_text", text: prompt }];
  if (img) content.push({ type: "input_image", image_url: `data:${img.mime};base64,${img.data}` });
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, input: [{ role: "user", content }], text: { format: { type: "json_object" } }, max_output_tokens: 32000 }),
    signal: TIMEOUT()
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw apiError(r.status, j.error && j.error.message);
  let out = typeof j.output_text === "string" ? j.output_text : "";
  if (!out) out = (j.output || []).filter(o => o.type === "message").flatMap(o => o.content || []).filter(c => c.type === "output_text").map(c => c.text).join("");
  if (!out) throw apiError(500, "빈 답이 왔어요 (" + (j.status || "이유 모름") + ")");
  return out;
}

async function callAnthropic(key, model, prompt, img) {
  const content = [];
  if (img) content.push({ type: "image", source: { type: "base64", media_type: img.mime, data: img.data } });
  content.push({ type: "text", text: prompt });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 16000, messages: [{ role: "user", content }] }),
    signal: TIMEOUT()
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw apiError(r.status, j.error && j.error.message);
  const out = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
  if (!out) throw apiError(500, "빈 답이 왔어요 (" + (j.stop_reason || "이유 모름") + ")");
  return out;
}

function buildPrompt(text, memo, hasImg) {
  const src = hasImg ? "첨부한 사진 속 수학 문제" + (text ? " (아래 글도 참고)" : "") : "아래 수학 문제";
  return `너는 대치동에서 가장 잘 가르치기로 소문난 중학교 수학 선생님이야. 학생은 중학교 2학년이야.
${src} 하나를, 칠판에 적어 가며 풀어 주는 3~5분짜리 강의 영상의 대본으로 만들어.
${text ? "\n[문제]\n" + text + "\n" : ""}${memo ? "\n[요청]\n" + memo + "\n" : ""}
## 가르치는 방식 (꼭 지켜)
1. 첫 챕터: 문제를 칠판에 짧게 옮겨 적고, 그림이 있는 문제면 그림을 하나씩 그리면서 읽어 줘.
2. 둘째 챕터: "이 문제는 ○○를 찾는 게 열쇠야"처럼 핵심 아이디어부터 말해.
3. 수식보다 그림 중심으로. 보조선, 길이가 같은 변, 크기가 같은 각, 합동이거나 닮은 도형을 색칠하고 표시하면서 "그림에서 이게 보이지?" 하고 짚어 줘.
4. 계산은 꼭 필요한 만큼만. 칠판 한 줄에 계산 한 단계만 쓰고, 그 step의 say에서 왜 그렇게 하는지 한 마디 붙여.
5. 확률·경우의 수처럼 도형이 없는 문제도 표(table)나 나뭇가지 그림(fig)으로 경우를 먼저 다 펼쳐 보여 줘.
6. 마지막 챕터: 정답과, 비슷한 문제에도 쓰는 요령 한 줄로 마무리.
7. 말투는 중2가 바로 알아듣는 쉬운 반말. 친절하고 차근차근.

## 분량
- 챕터 5~7개, step은 모두 합쳐 18~32개.
- say 전체 합계 한글 1,100~1,700자 (읽으면 3~5분).
- step 하나의 say는 25~110자. 그림이 바뀌는 순간과 say가 맞도록 잘게 나눠.
- say는 소리 내어 읽는 문장이야. 기호 없이 말로 써. (∠A → 각 A, △ABC → 삼각형 ABC, 4² → 4의 제곱, × → 곱하기, BM = MC → BM과 MC의 길이가 같아)
- 칠판 글씨(t)는 짧게, 한 줄 20자 안팎. 기호를 써도 돼: × ÷ − ² ° ∠ △ ⊥ ∽ ≡ ∥ √ π

## JSON 형식 (이 형식의 JSON 하나만 출력)
{
 "title": "강의 제목 (무엇으로 무엇을 구하는지, 25자 이내)",
 "unit": "단원 이름",
 "answer": "최종 정답 (객관식이면 번호와 값)",
 "tip": "요령 한 줄",
 "points": {"A": [x, y]},
 "chapters": [
  {"title": "챕터 제목(10자 이내)", "steps": [
   {"say": "선생님 말", "board": [칠판 동작], "fig": [그림 동작]}
  ]}
 ]
}

### points
- 오른쪽 그림판의 점 좌표. x, y 모두 0~100이고 y는 아래로 갈수록 커져. 5~95 안에 두고, 그림이 그림판 가운데에 크게 오도록.
- 실제 길이와 각도 비율을 최대한 지켜 (8cm와 2cm면 길이 비가 4:1).
- 점 이름은 문제와 같게. 보조 그림처럼 같은 이름을 다른 위치에 또 그려야 하면 다른 키("A2" 등)를 쓰고 lab의 text로 "A"라고 표시해.
- 그림이 전혀 필요 없는 문제면 {} (그러면 칠판이 화면 전체를 써).

### board 동작 (왼쪽 칠판에 위에서부터 한 줄씩 자동으로 적혀. 한 페이지에 9줄쯤)
- {"t":"글씨", "c":"black|red|blue", "s":"h|n|s", "box":true, "u":true}  s: h=제목·정답처럼 크게, n=보통, s=작게. box=네모 강조, u=밑줄. c·s·box·u는 생략 가능.
- {"gap":true}  한 줄 띄우기
- {"clear":true}  칠판을 지우고 새 페이지 (챕터가 바뀔 때 주로)
- {"table":[["", "1", "2"], ["1", "(1,1)", "(1,2)"]], "hl":[[1,2]]}  표 (최대 7행 7열). hl은 동그라미 칠 칸 [행, 열] (0부터).

### fig 동작 (오른쪽 그림판, 점은 points의 이름으로)
- {"seg":["A","B"], "dash":true, "c":"red"}  선분 (dash=점선 보조선)
- {"poly":["A","B","C"], "fill":"yellow|purple|green|blue|red|gray", "id":"이름"}  도형 색칠
- {"lab":"A", "text":"A", "pos":"n|s|e|w|ne|nw|se|sw"}  점 이름 쓰기 (text, pos 생략 가능)
- {"txt":"4cm", "on":["A","H"], "side":"n|s|e|w", "c":"red", "id":"이름"}  선분 옆에 길이 등 쓰기
- {"txt":"1/2", "at":"P", "c":"blue"}  점 P 자리에 글씨 (나뭇가지 끝의 결과 등)
- {"right":["B","H","A"]}  직각 표시 (가운데 점이 꼭짓점)
- {"ang":["A","B","C"], "m":"dot|arc|arc2"}  각 표시 (가운데가 꼭짓점). 크기가 같은 각끼리는 같은 m
- {"tick":["B","M"], "n":1}  길이가 같은 선분 표시 (같은 길이끼리 같은 n)
- {"dot":"M"}  점 찍기
- {"circle":"O", "r":30}  원 (r도 0~100 좌표 단위)
- {"hide":"이름"} / {"show":"이름"}  id 붙인 것 숨기기 / 다시 보이기
- {"figclear":true} / {"figrestore":true}  그림판 잠깐 비우기 / 비우기 전 그림으로 되돌리기

## 규칙
- 그림은 그걸 설명하는 바로 그 step의 fig에 넣어. step 하나의 fig는 0~10개.
- 나뭇가지 그림은 points에 갈래 점들을 잡고 seg와 txt(at)로 그려.
- 정답과 모든 계산을 두 번 확인해. 틀린 풀이는 절대 안 돼.
- 사진이 흐리거나 문제가 여러 개면 가장 크게 보이는 문제 하나만 풀어.
- 출력은 JSON 하나. 코드펜스나 앞뒤 설명을 쓰지 마.`;
}
