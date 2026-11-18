/* ===== 강의 데이터 + 타임라인 엔진 (DOM 없음) ===== */
const PEN_FONT = '"Nanum Pen Script", "Gaegu", "Apple SD Gothic Neo", cursive';
const SZ = { h: 60, n: 50, s: 42 };
const BRD = { x: 80, top: 124, lh: 66, maxRow: 10.2, splitW: 740, fullW: 1440 };
const FIG = { x: 850, y: 58, s: 7 };
const POS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [0.72, -0.72], nw: [-0.72, -0.72], se: [0.72, 0.72], sw: [-0.72, 0.72] };
const COLORS = ["black", "red", "blue", "green", "orange", "purple"];
const FILLS = ["yellow", "purple", "green", "blue", "red", "gray"];
const SAY_RATE = 0.155; // 한 글자 읽는 데 걸리는 대략적인 시간(초)

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const unit = (v, fb) => { const l = Math.hypot(v[0], v[1]); return l < 1e-6 ? (fb || [1, 0]) : [v[0] / l, v[1] / l]; };
const fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

/* ---------- 기본 강의: 뉴fine 수학 106번 ---------- */
const L106 = {
  id: "b106",
  builtin: true,
  title: "직각삼각형 속 닮음으로 넓이 구하기",
  unit: "도형의 닮음 · 106번",
  answer: "② 6cm²",
  tip: "직각에서 빗변으로 수선을 내리면 닮은 삼각형 2개! (수선)² = (한쪽 조각) × (다른 조각)",
  points: {
    A: [77, 38], B: [5, 74], C: [95, 74], H: [77, 74], M: [50, 74],
    a1: [2, 66], h1: [26, 66], c1: [26, 54],
    b2: [44, 66], h2: [92, 66], a2: [92, 42]
  },
  chapters: [
    { title: "문제 읽기", steps: [
      { say: "자, 106번 문제 같이 풀어 보자. 문제를 한 줄씩 읽으면서 그림도 하나씩 그려 볼게.",
        board: [{ t: "106번", s: "h", c: "blue" }] },
      { say: "각 A가 90도인 직각삼각형 ABC가 있어. 왼쪽 아래가 B, 오른쪽 아래가 C, 맨 위 꼭짓점이 A야.",
        board: [{ t: "∠A = 90° 인 직각삼각형 ABC" }],
        fig: [{ seg: ["B", "C"] }, { seg: ["C", "A"] }, { seg: ["A", "B"] }, { lab: "B" }, { lab: "C" }, { lab: "A", pos: "n" }, { right: ["B", "A", "C"] }] },
      { say: "M은 BC의 한가운데 점이야. BM과 MC의 길이가 같다는 뜻으로, 짧은 선을 하나씩 그어 둘게.",
        board: [{ t: "BM = MC → M은 BC의 가운데" }],
        fig: [{ dot: "M" }, { lab: "M", pos: "s" }, { tick: ["B", "M"] }, { tick: ["M", "C"] }] },
      { say: "그리고 A에서 BC에 수직으로 선을 내렸어. 만나는 점이 H야. AH는 4센티미터, HC는 2센티미터.",
        board: [{ t: "AH ⊥ BC,  AH = 4,  HC = 2" }],
        fig: [{ seg: ["A", "H"] }, { right: ["A", "H", "C"] }, { lab: "H", pos: "s" }, { txt: "4", on: ["A", "H"] }, { txt: "2", on: ["H", "C"] }] },
      { say: "구하는 건 삼각형 AMH의 넓이야. A와 M을 이어서 생긴 삼각형, 그림에서 노란색으로 칠한 부분이지?",
        board: [{ t: "△AMH 의 넓이는?", c: "red", u: true }],
        fig: [{ seg: ["A", "M"], dash: true }, { poly: ["A", "M", "H"], fill: "yellow", id: "amh" }] }
    ] },
    { title: "핵심 아이디어", steps: [
      { say: "풀기 전에 열쇠부터 알려 줄게. 이 문제는 직각삼각형 안에 숨어 있는 닮은 삼각형 두 개를 찾는 게 열쇠야.",
        board: [{ gap: true }, { t: "열쇠: 숨어 있는 닮은 삼각형 2개!", c: "red", box: true }] },
      { say: "왜냐하면 BH 길이만 알면 MH를 구할 수 있고, MH를 알면 넓이는 바로 나오거든. 지금 BH는 모르니까 물음표야.",
        board: [{ t: "BH → MH → △AMH 넓이", c: "blue" }],
        fig: [{ txt: "?", on: ["B", "H"], id: "bhq", c: "red" }] },
      { say: "삼각형 넓이는 밑변 곱하기 높이 나누기 2잖아. 높이 AH는 4로 이미 주어졌으니까, 밑변 MH만 찾으면 돼.",
        board: [{ t: "넓이 = 밑변 MH × 높이 AH ÷ 2", s: "s" }] }
    ] },
    { title: "닮은 삼각형 찾기", steps: [
      { say: "자, 칠판을 넘길게. 그림을 봐. 수직선 AH가 큰 삼각형을 두 조각으로 나눴어. 보라색 삼각형 ABH, 그리고 초록색 삼각형 AHC.",
        board: [{ clear: true }, { t: "닮은 삼각형 찾기", s: "h", c: "blue" }],
        fig: [{ hide: "amh" }, { poly: ["A", "B", "H"], fill: "purple", id: "abh" }, { poly: ["A", "H", "C"], fill: "green", id: "ahc" }] },
      { say: "각 B의 크기를 동그라미라고 해 볼게. 그림에 주황색 점으로 표시해 둘게.",
        board: [{ t: "∠B = ● 라고 하면" }],
        fig: [{ ang: ["A", "B", "H"], m: "dot" }] },
      { say: "큰 삼각형 ABC에서 각 A가 90도니까, 각 C는 90도 빼기 동그라미가 돼.",
        board: [{ t: "△ABC: ∠C = 90° − ●" }] },
      { say: "이제 초록 삼각형 AHC를 봐. 각 H가 90도, 각 C가 90도 빼기 동그라미야. 그럼 남은 각 CAH는? 바로 동그라미야!",
        board: [{ t: "△AHC: ∠CAH = ●" }],
        fig: [{ ang: ["H", "A", "C"], m: "dot" }] },
      { say: "그림에 동그라미가 두 군데 보이지? 두 삼각형 모두 직각 하나랑 동그라미 하나를 가지고 있어. 그래서 두 삼각형은 AA 닮음이야.",
        board: [{ t: "직각 + ● 가 같음 → AA 닮음", c: "red" }, { t: "△ABH ∽ △CAH", c: "red", box: true }] }
    ] },
    { title: "BH 구하기", steps: [
      { say: "두 삼각형을 똑같은 방향으로 돌려서 나란히 놓아 볼게. 동그라미가 둘 다 왼쪽 아래에 오도록. 먼저 초록 삼각형.",
        board: [{ clear: true }, { t: "BH 구하기", s: "h", c: "blue" }],
        fig: [{ figclear: true }, { poly: ["a1", "h1", "c1"], fill: "green" }, { seg: ["a1", "h1"] }, { seg: ["h1", "c1"] }, { seg: ["c1", "a1"] },
              { right: ["a1", "h1", "c1"] }, { ang: ["c1", "a1", "h1"], m: "dot" }, { lab: "a1", text: "A", pos: "w" }, { lab: "h1", text: "H", pos: "se" }, { lab: "c1", text: "C", pos: "n" }] },
      { say: "초록 삼각형은 밑변 AH가 4, 세로 HC가 2야. 밑변이 세로의 딱 2배지?",
        board: [{ t: "초록: 밑변 4, 세로 2 → 밑변 = 세로 × 2" }],
        fig: [{ txt: "4", on: ["a1", "h1"], side: "s" }, { txt: "2", on: ["h1", "c1"], side: "e" }] },
      { say: "이번엔 보라 삼각형. 밑변이 BH, 세로가 AH, 4야. 모양이 똑같으니까, 여기서도 밑변이 세로의 2배여야 해.",
        board: [{ t: "보라: 밑변 BH, 세로 4 → BH = 4 × 2" }],
        fig: [{ poly: ["b2", "h2", "a2"], fill: "purple" }, { seg: ["b2", "h2"] }, { seg: ["h2", "a2"] }, { seg: ["a2", "b2"] }, { right: ["b2", "h2", "a2"] },
              { ang: ["a2", "b2", "h2"], m: "dot" }, { lab: "b2", text: "B", pos: "w" }, { lab: "h2", text: "H", pos: "se" }, { lab: "a2", text: "A", pos: "n" },
              { txt: "BH", on: ["b2", "h2"], side: "s", c: "red" }, { txt: "4", on: ["h2", "a2"], side: "e" }] },
      { say: "시험지에는 비례식으로 쓰면 돼. 밑변 대 세로의 비가 같으니까, BH 대 4는 4 대 2.",
        board: [{ t: "BH : 4 = 4 : 2" }] },
      { say: "비례식에서는 바깥쪽끼리 곱한 값과 안쪽끼리 곱한 값이 같아. 그래서 BH 곱하기 2는 4 곱하기 4, 16이야.",
        board: [{ t: "BH × 2 = 4 × 4 = 16" }] },
      { say: "양쪽을 2로 나누면, BH는 8! 드디어 찾았다.",
        board: [{ t: "BH = 8", c: "red", s: "h", box: true }] }
    ] },
    { title: "MH 구하기", steps: [
      { say: "다시 원래 그림으로 돌아가자. 물음표였던 BH 자리에 8을 써 넣을게.",
        board: [{ clear: true }, { t: "MH 구하기", s: "h", c: "blue" }],
        fig: [{ figrestore: true }, { hide: "bhq" }, { txt: "8", on: ["B", "H"], c: "red" }] },
      { say: "BC 전체 길이는 BH 8에 HC 2를 더한 거니까 10이야.",
        board: [{ t: "BC = 8 + 2 = 10" }] },
      { say: "M은 BC의 한가운데니까, MC는 10의 절반인 5.",
        board: [{ t: "MC = 10 ÷ 2 = 5" }] },
      { say: "그림을 봐. M이 H보다 B 쪽에 있지? 그래서 MH는 MC에서 HC를 빼면 돼. 5 빼기 2는 3.",
        board: [{ t: "MH = 5 − 2 = 3", c: "red", box: true }],
        fig: [{ hide: "abh" }, { hide: "ahc" }, { show: "amh" }, { txt: "3", on: ["M", "H"], side: "n", c: "red" }] }
    ] },
    { title: "넓이와 정답", steps: [
      { say: "이제 노란 삼각형 AMH의 넓이를 구하자. AH가 BC에 수직이니까, 밑변은 MH, 높이는 AH 그대로야.",
        board: [{ gap: true }, { t: "△AMH: 밑변 3, 높이 4" }],
        fig: [{ seg: ["M", "H"], c: "red" }, { seg: ["A", "H"], c: "red" }] },
      { say: "밑변 3 곱하기 높이 4는 12, 나누기 2를 하면 6. 그러니까 정답은 2번, 6 제곱센티미터야.",
        board: [{ t: "넓이 = 3 × 4 ÷ 2 = 6" }, { t: "답: ② 6cm²", c: "red", s: "h", box: true }] }
    ] },
    { title: "오늘의 요령", steps: [
      { say: "마지막으로 오늘의 요령! 직각인 꼭짓점에서 빗변으로 수선을 내리면, 닮은 삼각형이 두 개 생겨.",
        board: [{ clear: true }, { t: "오늘의 요령", s: "h", c: "blue" }, { t: "직각에서 빗변으로 수선 → 닮은 △ 2개" }] },
      { say: "그래서 수선의 제곱은, 빗변의 두 조각을 곱한 값과 같아. 이 문제에서는 4의 제곱 16이, 8 곱하기 2와 같지.",
        board: [{ t: "(수선)² = (한쪽 조각) × (다른 조각)", c: "red", box: true }, { t: "4² = 8 × 2 = 16" }] },
      { say: "비슷한 문제를 만나면, 숨어 있는 닮은 삼각형부터 찾아봐. 오늘 수업은 여기까지! 수고했어.",
        board: [{ t: "→ 숨은 닮음부터 찾기!", c: "blue" }] }
    ] }
  ]
};
const BUILTIN = [L106];

/* ---------- AI가 만든 대본 검사·정리 ---------- */
function normalizeLecture(raw) {
  if (!raw || typeof raw !== "object") throw new Error("대본 형식이 아니에요.");
  const str = v => (typeof v === "string" ? v.trim() : "");
  const L = { title: str(raw.title).slice(0, 60) || "새 강의", unit: str(raw.unit).slice(0, 40), answer: str(raw.answer).slice(0, 80), tip: str(raw.tip).slice(0, 160), points: {}, chapters: [] };
  if (raw.points && typeof raw.points === "object" && !Array.isArray(raw.points)) {
    for (const k of Object.keys(raw.points).slice(0, 80)) {
      const p = raw.points[k];
      if (Array.isArray(p) && p.length >= 2 && isFinite(p[0]) && isFinite(p[1])) L.points[String(k)] = [clamp(+p[0], 0, 100), clamp(+p[1], 0, 100)];
    }
  }
  const okP = n => (typeof n === "string" && !!L.points[n]) || (Array.isArray(n) && n.length === 2 && isFinite(n[0]) && isFinite(n[1]));
  const okArr = (a, n) => Array.isArray(a) && a.length === n && a.every(x => typeof x === "string" && L.points[x]);
  const col = c => (COLORS.includes(c) ? c : undefined);
  const ids = new Set();
  for (const ch of (Array.isArray(raw.chapters) ? raw.chapters : []).slice(0, 10)) {
    const steps = [];
    for (const s of (Array.isArray(ch && ch.steps) ? ch.steps : []).slice(0, 14)) {
      if (!s || typeof s !== "object") continue;
      const say = str(s.say).slice(0, 400);
      const board = [];
      for (const b of (Array.isArray(s.board) ? s.board : []).slice(0, 10)) {
        if (!b || typeof b !== "object") continue;
        if (b.clear) board.push({ clear: true });
        else if (b.gap) board.push({ gap: true });
        else if (Array.isArray(b.table)) {
          const rows = b.table.slice(0, 8).filter(Array.isArray).map(r => r.slice(0, 8).map(c => String(c == null ? "" : c).slice(0, 12)));
          if (rows.length) board.push({ table: rows, hl: Array.isArray(b.hl) ? b.hl.filter(x => Array.isArray(x) && x.length === 2).slice(0, 40) : [], c: col(b.c) });
        } else if (typeof b.t === "string" && b.t.trim()) {
          board.push({ t: b.t.trim().slice(0, 70), c: col(b.c), s: ["h", "n", "s"].includes(b.s) ? b.s : "n", box: !!b.box, u: !!b.u });
        }
      }
      const fig = [];
      for (const a of (Array.isArray(s.fig) ? s.fig : []).slice(0, 16)) {
        if (!a || typeof a !== "object") continue;
        const o = {};
        if (a.id != null) o.id = String(a.id).slice(0, 30);
        if (col(a.c)) o.c = a.c;
        if (a.figclear) fig.push({ figclear: true });
        else if (a.figrestore) fig.push({ figrestore: true });
        else if (a.hide != null) fig.push({ hide: String(a.hide) });
        else if (a.show != null) fig.push({ show: String(a.show) });
        else if (okArr(a.seg, 2)) fig.push(Object.assign(o, { seg: a.seg, dash: !!a.dash }));
        else if (Array.isArray(a.poly) && a.poly.length >= 3 && a.poly.every(x => L.points[x])) fig.push(Object.assign(o, { poly: a.poly.slice(0, 12), fill: FILLS.includes(a.fill) ? a.fill : "yellow" }));
        else if (typeof a.lab === "string" && L.points[a.lab]) fig.push(Object.assign(o, { lab: a.lab, text: a.text != null ? String(a.text).slice(0, 8) : undefined, pos: POS[a.pos] ? a.pos : undefined }));
        else if (a.txt != null && okArr(a.on, 2)) fig.push(Object.assign(o, { txt: String(a.txt).slice(0, 16), on: a.on, side: POS[a.side] ? a.side : undefined }));
        else if (a.txt != null && okP(a.at)) fig.push(Object.assign(o, { txt: String(a.txt).slice(0, 16), at: a.at, pos: POS[a.pos] ? a.pos : undefined }));
        else if (okArr(a.right, 3)) fig.push(Object.assign(o, { right: a.right }));
        else if (okArr(a.ang, 3)) fig.push(Object.assign(o, { ang: a.ang, m: ["dot", "arc", "arc2"].includes(a.m) ? a.m : "arc" }));
        else if (okArr(a.tick, 2)) fig.push(Object.assign(o, { tick: a.tick, n: clamp(parseInt(a.n) || 1, 1, 3) }));
        else if (typeof a.dot === "string" && L.points[a.dot]) fig.push(Object.assign(o, { dot: a.dot }));
        else if (typeof a.circle === "string" && L.points[a.circle] && isFinite(a.r) && a.r > 0) fig.push(Object.assign(o, { circle: a.circle, r: clamp(+a.r, 1, 60), dash: !!a.dash }));
        if (o.id) ids.add(o.id);
      }
      if (say || board.length || fig.length) steps.push({ say, board, fig });
    }
    if (steps.length) L.chapters.push({ title: str(ch && ch.title).slice(0, 16) || "풀이", steps });
  }
  if (!L.chapters.length) throw new Error("대본에 풀이 단계가 없어요.");
  return L;
}

/* ---------- 강의 → 타임라인 ---------- */
function actPts(a) {
  const r = [];
  for (const k of ["seg", "poly", "right", "ang", "tick"]) if (Array.isArray(a[k])) r.push(...a[k]);
  if (a.txt != null && Array.isArray(a.on)) r.push(...a.on);
  for (const k of ["lab", "dot", "circle"]) if (typeof a[k] === "string") r.push(a[k]);
  if (a.txt != null && a.at != null) r.push(a.at);
  return r;
}

function wrapText(str, size, maxW, measure) {
  const fit = s => { const w = measure(s, size); return w > maxW ? { s, size: size * maxW / w, w: maxW } : { s, size, w }; };
  const w0 = measure(str, size);
  if (w0 <= maxW / 0.78) return [fit(str)];
  const words = str.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (!cur || measure(t, size) <= maxW) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.map(fit);
}

function compileLecture(lec, measure) {
  const pts = lec.points || {};
  const split = Object.keys(pts).length > 0;
  const maxW = split ? BRD.splitW : BRD.fullW;
  const P = n => {
    if (Array.isArray(n)) return [FIG.x + n[0] * FIG.s, FIG.y + n[1] * FIG.s];
    const p = pts[n];
    return p ? [FIG.x + p[0] * FIG.s, FIG.y + p[1] * FIG.s] : null;
  };

  // 장면별 무게중심 (라벨을 바깥쪽으로 밀어낼 때 사용)
  const scenes = [new Map()];
  let cur = 0;
  const stack = [];
  const sceneOf = new Map();
  for (const ch of lec.chapters) for (const st of ch.steps) for (const a of (st.fig || [])) {
    if (a.figclear) { stack.push(cur); scenes.push(new Map()); cur = scenes.length - 1; }
    else if (a.figrestore) cur = stack.length ? stack.pop() : 0;
    sceneOf.set(a, cur);
    for (const n of actPts(a)) { const p = P(n); if (p) scenes[cur].set(JSON.stringify(n), p); }
  }
  const cent = scenes.map(m => {
    const arr = [...m.values()];
    return arr.length ? [arr.reduce((s, p) => s + p[0], 0) / arr.length, arr.reduce((s, p) => s + p[1], 0) / arr.length] : [FIG.x + 350, FIG.y + 350];
  });

  const els = [], steps = [], chapters = [], byId = {};
  let t = 0, row = 0, page = [], fig = [];
  const figStack = [];
  const mk = (o, start, dur) => { o.start = start; o.dur = Math.max(0.001, dur); o.iv = [[start, Infinity, false]]; els.push(o); return o; };
  const isOpen = e => e.iv[e.iv.length - 1][1] === Infinity;
  const close = (e, T) => { const last = e.iv[e.iv.length - 1]; if (last[1] === Infinity) last[1] = Math.max(T, last[0] + 0.01); };
  const reopen = (e, T) => { if (!isOpen(e)) e.iv.push([T, Infinity, true]); };
  const newPage = T => { for (const e of page) close(e, T); page = []; row = 0; };

  lec.chapters.forEach((ch, ci) => {
    const chStart = t;
    ch.steps.forEach(step => {
      const st = { start: t, say: step.say || "", ci };
      let tb = t, tf = t;

      for (const b of (step.board || [])) {
        if (b.clear) { if (page.length) { newPage(tb); tb += 0.35; } else row = 0; continue; }
        if (b.gap) { row += 0.6; continue; }
        if (b.table) {
          const rows = b.table, nr = rows.length, nc = Math.max(...rows.map(r => r.length));
          const fs = 38;
          let cw = 0;
          for (const r of rows) for (const c of r) cw = Math.max(cw, measure(String(c), fs));
          cw = clamp(cw + 30, 66, 170);
          if (cw * nc > maxW) cw = maxW / nc;
          const rh = 54, need = nr * rh / BRD.lh + 0.4;
          if (row > 0 && row + need - 1 > BRD.maxRow) { newPage(tb); tb += 0.35; }
          const dur = clamp(0.6 + nr * nc * 0.09, 1, 7);
          const e = mk({ type: "table", layer: "board", x: BRD.x, y: BRD.top + row * BRD.lh - 46, cw, rh, nr, nc, fs, cells: rows, hl: b.hl || [], color: b.c || "black" }, tb, dur);
          e.cellSize = rows.map(r => r.map(c => { const w = measure(String(c), fs); return w > cw - 12 ? fs * (cw - 12) / w : fs; }));
          page.push(e); tb += dur + 0.1; row += need;
          continue;
        }
        if (typeof b.t === "string") {
          const size = SZ[b.s] || SZ.n;
          const lines = wrapText(b.t, size, maxW, measure);
          const need = lines.length * (b.s === "h" ? 1.1 : 1) + (b.box ? 0.3 : 0);
          if (row > 0 && row + need - 1 > BRD.maxRow) { newPage(tb); tb += 0.35; }
          const lineEls = [];
          for (const ln of lines) {
            const y = BRD.top + row * BRD.lh;
            const dur = clamp(0.25 + [...ln.s].length * 0.07, 0.45, 2.8);
            const e = mk({ type: "text", layer: "board", x: BRD.x, y, w: ln.w, size: ln.size, color: b.c || "black", txt: ln.s }, tb, dur);
            page.push(e); lineEls.push(e);
            tb += dur + 0.08;
            row += b.s === "h" ? 1.1 : 1;
          }
          const f = lineEls[0], L = lineEls[lineEls.length - 1];
          if (b.u) { const e = mk({ type: "under", layer: "board", x: L.x, y: L.y + 13, w: L.w, line: L, color: b.c || "red" }, tb, 0.35); page.push(e); tb += 0.4; }
          if (b.box) {
            const w = Math.max(...lineEls.map(e => e.w));
            const top = f.y - f.size * 0.86;
            const e = mk({ type: "box", layer: "board", x: f.x - 16, y: top, w: w + 32, h: (L.y + 17) - top, lines: lineEls, color: b.c || "red" }, tb, 0.5);
            page.push(e); tb += 0.55; row += 0.3;
          }
        }
      }

      for (const a of (step.fig || [])) {
        const cc = cent[sceneOf.get(a) || 0];
        if (a.figclear) { for (const e of fig) close(e, tf); figStack.push(fig); fig = []; tf += 0.3; continue; }
        if (a.figrestore) { for (const e of fig) close(e, tf); const prev = figStack.pop() || []; for (const e of prev) reopen(e, tf); fig = prev; tf += 0.3; continue; }
        if (a.hide != null) { const e = byId[a.hide]; if (e && isOpen(e)) { close(e, tf); fig = fig.filter(x => x !== e); } tf += 0.2; continue; }
        if (a.show != null) { const e = byId[a.show]; if (e && !isOpen(e)) { reopen(e, tf); fig.push(e); } tf += 0.2; continue; }
        let e = null, d = 0.35;
        if (a.seg) {
          const p = P(a.seg[0]), q = P(a.seg[1]);
          if (p && q) { d = clamp(Math.hypot(q[0] - p[0], q[1] - p[1]) / 700, 0.3, 0.9); e = { type: "seg", x1: p[0], y1: p[1], x2: q[0], y2: q[1], color: a.c || "black", dash: !!a.dash, wd: a.c && a.c !== "black" ? 5 : 3.4 }; }
        } else if (a.poly) {
          const ps = a.poly.map(P);
          if (ps.every(Boolean)) { e = { type: "poly", pts: ps, fill: a.fill || "yellow" }; d = 0.5; }
        } else if (a.lab != null) {
          const p = P(a.lab);
          if (p) { const dir = a.pos && POS[a.pos] ? POS[a.pos] : unit([p[0] - cc[0], p[1] - cc[1]], [0, 1]); e = { type: "label", x: p[0] + dir[0] * 30, y: p[1] + dir[1] * 30, txt: a.text || a.lab, size: 48, color: a.c || "black" }; d = 0.3; }
        } else if (a.txt != null && a.on) {
          const p = P(a.on[0]), q = P(a.on[1]);
          if (p && q) {
            const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
            let n = unit([-(q[1] - p[1]), q[0] - p[0]], [0, 1]);
            if (a.side && POS[a.side]) { const s = POS[a.side]; if (n[0] * s[0] + n[1] * s[1] < 0) n = [-n[0], -n[1]]; }
            else if ((m[0] - cc[0]) * n[0] + (m[1] - cc[1]) * n[1] < 0) n = [-n[0], -n[1]];
            const off = 28 + Math.min(30, String(a.txt).length * 4);
            e = { type: "label", x: m[0] + n[0] * off, y: m[1] + n[1] * off, txt: String(a.txt), size: 44, color: a.c || "black" };
          }
        } else if (a.txt != null && a.at != null) {
          const p = P(a.at);
          if (p) { const dir = a.pos && POS[a.pos] ? POS[a.pos] : [0, 0]; e = { type: "label", x: p[0] + dir[0] * 30, y: p[1] + dir[1] * 30, txt: String(a.txt), size: 42, color: a.c || "black" }; }
        } else if (a.right) {
          const [p, v, q] = a.right.map(P);
          if (p && v && q) {
            const u = unit([p[0] - v[0], p[1] - v[1]]), w = unit([q[0] - v[0], q[1] - v[1]]), s = 20;
            e = { type: "path", d: `M${v[0] + u[0] * s} ${v[1] + u[1] * s} L${v[0] + (u[0] + w[0]) * s} ${v[1] + (u[1] + w[1]) * s} L${v[0] + w[0] * s} ${v[1] + w[1] * s}`, color: a.c || "black", wd: 2.4 };
            d = 0.3;
          }
        } else if (a.ang) {
          const [p, v, q] = a.ang.map(P);
          if (p && v && q) {
            const u = unit([p[0] - v[0], p[1] - v[1]]), w = unit([q[0] - v[0], q[1] - v[1]]);
            const sweep = u[0] * w[1] - u[1] * w[0] > 0 ? 1 : 0;
            const arc = r => `M${v[0] + u[0] * r} ${v[1] + u[1] * r} A${r} ${r} 0 0 ${sweep} ${v[0] + w[0] * r} ${v[1] + w[1] * r}`;
            const m = a.m || "arc";
            const bis = unit([u[0] + w[0], u[1] + w[1]], [0, -1]);
            e = { type: "ang", d: arc(44) + (m === "arc2" ? " " + arc(52) : ""), dot: m === "dot" ? [v[0] + bis[0] * 31, v[1] + bis[1] * 31] : null, color: a.c || "orange" };
            d = 0.35;
          }
        } else if (a.tick) {
          const p = P(a.tick[0]), q = P(a.tick[1]);
          if (p && q) {
            const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], dir = unit([q[0] - p[0], q[1] - p[1]]), n = [-dir[1], dir[0]], k = a.n || 1;
            let dd = "";
            for (let i = 0; i < k; i++) { const o = (i - (k - 1) / 2) * 8, c = [m[0] + dir[0] * o, m[1] + dir[1] * o]; dd += `M${c[0] - n[0] * 11} ${c[1] - n[1] * 11} L${c[0] + n[0] * 11} ${c[1] + n[1] * 11} `; }
            e = { type: "path", d: dd, color: a.c || "black", wd: 3 };
            d = 0.25;
          }
        } else if (a.dot != null) {
          const p = P(a.dot);
          if (p) { e = { type: "dot", x: p[0], y: p[1], color: a.c || "black" }; d = 0.2; }
        } else if (a.circle != null) {
          const p = P(a.circle);
          if (p) { e = { type: "circle", x: p[0], y: p[1], r: a.r * FIG.s, color: a.c || "black", dash: !!a.dash }; d = 1; }
        }
        if (e) {
          e.layer = e.type === "poly" ? "fill" : e.type === "label" ? "lab" : "line";
          mk(e, tf, d);
          fig.push(e);
          if (a.id) byId[a.id] = e;
          tf += d + 0.06;
        }
      }

      const est = st.say ? [...st.say].length * SAY_RATE + 0.7 : 0;
      st.dur = Math.max(tb - t, tf - t, est, 1.2) + 0.35;
      steps.push(st);
      t += st.dur;
    });
    chapters.push({ title: ch.title, start: chStart, end: t });
  });
  return { els, steps, chapters, total: t, split };
}

/* ---------- AI에게 보내는 지시문 (서버 api/generate.js와 같은 내용) ---------- */
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

if (typeof module !== "undefined") module.exports = { L106, BUILTIN, compileLecture, normalizeLecture, fmtTime, wrapText, BRD, FIG };
