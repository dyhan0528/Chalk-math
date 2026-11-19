(function () {
"use strict";
const NS = "http://www.w3.org/2000/svg";
const $ = id => document.getElementById(id);
function S(tag, attrs, parent) { const e = document.createElementNS(NS, tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function H(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) { if (k === "class") e.className = attrs[k]; else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); }
  for (const c of kids) if (c != null) e.append(c.nodeType ? c : String(c));
  return e;
}
const ICON = {
  play: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" fill="currentColor"/></svg>',
  prev: '<svg viewBox="0 0 24 24" width="19" height="19"><path d="M6 5h2.4v14H6zM19 5v14L9.5 12z" fill="currentColor"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="19" height="19"><path d="M15.6 5H18v14h-2.4zM5 5v14l9.5-7z" fill="currentColor"/></svg>',
  vol: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 8.7a4.6 4.6 0 0 1 0 6.6M18.2 6.2a8.2 8.2 0 0 1 0 11.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.8 9.5l5 5M20.8 9.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  cc: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10.4 10.2a2.2 2.2 0 1 0 0 3.6M16.8 10.2a2.2 2.2 0 1 0 0 3.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
};
const store = {
  get(k, d) { try { const v = localStorage.getItem("chalk:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("chalk:" + k, JSON.stringify(v)); } catch (e) {} }
};
const IS_WEB = /^https?:$/.test(location.protocol);
// 선생님 서버 주소: 파일로 열어도 이 서버를 불러요. (빌드할 때 window.CHALK_SERVER에 넣어 둬요)
const BUILT_SERVER = String(window.CHALK_SERVER || "").trim().replace(/\/+$/, "");
try { const q = new URLSearchParams(location.search).get("server"); if (q != null) localStorage.setItem("chalk:server", JSON.stringify(q.trim().replace(/\/+$/, ""))); } catch (e) {}
let API_BASE = null;   // "" = 같은 사이트, "https://..." = 선생님 서버, null = 연결 안 됨
const CAN_STORE = (() => { try { localStorage.setItem("chalk:_t", "1"); localStorage.removeItem("chalk:_t"); return true; } catch (e) { return false; } })();
let toastT = 0;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3600); }

/* ---------- 글자 폭 재기 ---------- */
const mctx = document.createElement("canvas").getContext("2d");
const mcache = new Map();
function measure(s, size) {
  const k = size + "|" + s;
  let w = mcache.get(k);
  if (w == null) { mctx.font = `${size}px ${PEN_FONT}`; w = mctx.measureText(s).width; mcache.set(k, w); }
  return w;
}
let fontsReady = false;
const fontP = (document.fonts && document.fonts.load ? Promise.race([document.fonts.load('50px "Nanum Pen Script"', "가A1"), new Promise(r => setTimeout(r, 3500))]) : Promise.resolve())
  .catch(() => {}).then(() => { fontsReady = true; mcache.clear(); durCache.clear(); });

/* ---------- 강의 목록 (이 기기에 저장) ---------- */
const loadMine = () => (store.get("mine", []) || []).map(x => { try { return Object.assign(normalizeLecture(x), { id: x.id, origin: "mine", created: x.created || 0, ai: x.ai || "" }); } catch (e) { return null; } }).filter(Boolean);
let myLecs = loadMine();
let libLecs = [];
let tempLec = null;
const durCache = new Map();
const allLecs = () => [...myLecs, ...libLecs, ...BUILTIN];
const findLec = id => (tempLec && tempLec.id === id) ? tempLec : allLecs().find(l => l.id === id);
function durOf(L) { let d = durCache.get(L.id); if (d == null) { try { d = compileLecture(L, measure).total; } catch (e) { d = 0; } durCache.set(L.id, d); } return d; }
const plain = L => { const { title, unit, answer, tip, points, chapters } = L; return { title, unit, answer, tip, points, chapters }; };
function persistMine() {
  if (!CAN_STORE) return false;
  try { localStorage.setItem("chalk:mine", JSON.stringify(myLecs.map(L => Object.assign(plain(L), { id: L.id, created: L.created, ai: L.ai || "" })))); return true; }
  catch (e) { toast("기기 저장 공간이 가득 찼어요. 안 쓰는 강의를 지워 주세요."); return false; }
}
function saveMine(L, ai) {
  const created = Date.now();
  const item = Object.assign(normalizeLecture(plain(L)), { id: "m-" + created.toString(36) + Math.floor(Math.random() * 1296).toString(36), origin: "mine", created, ai: ai || L.ai || "" });
  myLecs = [item, ...myLecs];
  persistMine();
  return item;
}

function go(h) { if (location.hash !== "#" + h) location.hash = h; else route(); }
function show(v) { for (const id of ["v-home", "v-player", "v-new"]) $(id).hidden = id !== v; window.scrollTo(0, 0); }
function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function route() {
  const h = location.hash.replace(/^#/, "");
  if (h.startsWith("s=")) {
    const code = h.slice(2), id = "t-" + hashCode(code);
    if (tempLec && tempLec.id === id) { show("v-player"); openLecture(tempLec); return; }
    decodeLecture(code).then(L => {
      tempLec = Object.assign(L, { id, origin: "shared" });
      show("v-player"); openLecture(tempLec);
    }, () => { toast("공유 링크를 읽지 못했어요. 링크가 잘리지 않았는지 확인해 주세요."); go("home"); });
    return;
  }
  if (h.startsWith("lec-")) {
    const L = findLec(h.slice(4));
    if (L) { show("v-player"); openLecture(L); return; }
    leavePlayer(); show("v-home"); renderHome();
  } else if (h === "new") { leavePlayer(); show("v-new"); checkAI(); }
  else { leavePlayer(); show("v-home"); renderHome(); }
}
window.addEventListener("hashchange", route);

/* ---------- 공유 링크 (강의를 주소 안에 압축해서 담기) ---------- */
const b64u = bytes => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s), out = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out; };
async function pipeBytes(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
async function encodeLecture(L) {
  const bytes = new TextEncoder().encode(JSON.stringify(plain(L)));
  if (window.CompressionStream) { try { return "z" + b64u(await pipeBytes(bytes, new CompressionStream("deflate-raw"))); } catch (e) {} }
  return "j" + b64u(bytes);
}
async function decodeLecture(code) {
  const tag = code[0], bytes = unb64u(decodeURIComponent(code.slice(1)));
  const raw = tag === "z" ? await pipeBytes(bytes, new DecompressionStream("deflate-raw")) : bytes;
  return normalizeLecture(JSON.parse(new TextDecoder().decode(raw)));
}
async function shareLecture(L) {
  if (!IS_WEB) { toast("공유 링크는 인터넷 주소로 올린 앱에서 만들 수 있어요. 지금은 ‘파일로 저장’한 강의 파일을 보내 주세요."); return; }
  const url = location.origin + location.pathname + "#s=" + await encodeLecture(L);
  if (navigator.share && document.body.classList.contains("touch")) {
    try { await navigator.share({ title: L.title, text: "칠판 수학 강의 · " + L.title, url }); return; }
    catch (e) { if (e && e.name === "AbortError") return; }
  }
  let ok = false;
  try { ok = await Promise.race([navigator.clipboard.writeText(url).then(() => true, () => false), new Promise(r => setTimeout(() => r(false), 1500))]); } catch (e) {}
  if (ok) toast("공유 링크를 복사했어요. 카톡이나 문자에 붙여 넣으세요.");
  else { $("shareUrl").value = url; $("shareModal").hidden = false; }
}
function exportLecture(L) {
  const blob = new Blob([JSON.stringify(plain(L), null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (L.title || "강의").replace(/[\\/:*?"<>|]/g, "").slice(0, 40) + ".json";
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
async function importFiles(files) {
  let n = 0, bad = 0;
  for (const f of files) {
    try {
      const data = JSON.parse(await f.text());
      for (const x of (Array.isArray(data) ? data : [data])) { try { saveMine(normalizeLecture(x)); n++; } catch (e) { bad++; } }
    } catch (e) { bad++; }
  }
  renderHome();
  toast(n ? `강의 ${n}개를 가져왔어요.` + (bad ? ` (${bad}개는 읽지 못했어요)` : "") : "강의 파일을 읽지 못했어요.");
}

function renderHome() {
  if ($("v-home").hidden) return;
  const g = $("grid");
  g.textContent = "";
  g.append(H("a", { class: "card", href: "#new" },
    H("div", { class: "thumb new" }, H("span", { class: "plus" }, "+"), "새 문제 강의 만들기", H("small", null, "문제 사진 한 장이면 돼요"))));
  for (const L of allLecs()) {
    const kind = L.builtin ? "기본 강의" : L.origin === "lib" ? "공유 강의" : "내가 만든 강의";
    g.append(H("a", { class: "card", href: "#lec-" + L.id },
      H("div", { class: "thumb" }, L.unit ? H("span", { class: "tunit" }, L.unit) : null, H("div", { class: "ttitle" }, L.title), H("span", { class: "dur" }, fmtTime(durOf(L)))),
      H("div", { class: "cmeta" }, H("div", { class: "ctitle" }, L.title), H("div", { class: "csub" }, kind + " · 챕터 " + L.chapters.length + "개"))));
  }
  renderInstall();
  const fn = $("fileNote");
  if (!IS_WEB) {
    fn.hidden = false;
    fn.textContent = CAN_STORE ? "지금은 앱 파일을 직접 열어서 쓰는 중이에요. 강의 만들기·보기는 되지만, 공유 링크는 인터넷 주소(Vercel)로 올린 뒤에 쓸 수 있어요."
      : "지금은 앱 파일을 직접 열어서 쓰는 중이에요. 이 방식에서는 만든 강의와 AI 키가 저장되지 않아요. 아끼는 강의는 ‘파일로 저장’해 두세요.";
  } else fn.hidden = true;
}

/* ---------- 홈 화면에 설치 ---------- */
let installEvt = null;
const isStandalone = () => { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; } };
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; renderInstall(); });
window.addEventListener("appinstalled", () => { installEvt = null; renderInstall(); toast("홈 화면에 설치했어요."); });
function renderInstall() {
  const c = $("installCard");
  if (isStandalone() || store.get("installX", false)) { c.hidden = true; return; }
  if (installEvt) { $("installMsg").textContent = "홈 화면에 설치하면 앱처럼 바로 열 수 있어요."; $("bInstall").hidden = false; c.hidden = false; }
  else if (isIOS) {
    const m = $("installMsg"); m.textContent = "";
    m.append("홈 화면에 추가하면 앱처럼 쓸 수 있어요. 사파리 아래쪽 ", H("b", null, "공유"), " 버튼 → ", H("b", null, "홈 화면에 추가"), "를 눌러 주세요.");
    $("bInstall").hidden = true; c.hidden = false;
  } else c.hidden = true;
}

/* ---------- 플레이어 상태 ---------- */
const P = { lec: null, comp: null, t: 0, drawnT: -1, playing: false, ended: false, drag: false, dirty: true, last: 0,
  speed: 1, voiceFails: 0, voiceOn: store.get("voice", true), ccOn: store.get("cc", true), theme: store.get("theme", "note"), restUntil: 0,
  sp: { step: -1, tok: 0, started: true, done: true, at: 0, hold: 0, paused: false } };
const VOICE = { kind: null, ko: null, web: false };
let segs = [], chItems = [], ui = {}, mountGen = 0;

function stepAt(t) {
  const st = P.comp.steps;
  let lo = 0, hi = st.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (st[m].start <= t + 1e-9) lo = m; else hi = m - 1; }
  return lo;
}
function chapterAt(t) { return P.comp.steps[stepAt(t)].ci; }

function drawRules() {
  const g = $("rules");
  g.textContent = "";
  for (let r = -1; r <= 11; r++) { const y = BRD.top + r * BRD.lh + 14; S("line", { x1: 40, y1: y, x2: 1560, y2: y, style: "stroke:var(--rule)", "stroke-width": 2 }, g); }
}

function mount(comp) {
  mountGen++;
  const layers = { fill: $("L-fill"), line: $("L-line"), lab: $("L-lab"), board: $("L-board") };
  for (const k in layers) layers[k].textContent = "";
  let n = 0;
  for (const e of comp.els) {
    const g = S("g", null, layers[e.layer || "board"]);
    e.g = g; e._d = null; e._p = -1; e._o = -1; e.fade = false; e.head = null;
    const col = `var(--c-${e.color || "black"})`;
    switch (e.type) {
      case "text": {
        const id = `k${mountGen}_${++n}`;
        const cp = S("clipPath", { id }, g);
        const r = S("rect", { x: e.x - 10, y: e.y - e.size * 1.2, height: e.size * 1.8, width: 0 }, cp);
        const tx = S("text", { x: e.x, y: e.y, "font-size": e.size.toFixed(1), "clip-path": `url(#${id})`, class: "pen", style: `fill:${col}` }, g);
        tx.textContent = e.txt;
        let aw = 0;
        try { aw = tx.getComputedTextLength(); } catch (er) {}
        if (aw > 0) {
          const maxW = comp.split ? BRD.splitW : BRD.fullW;
          if (aw > maxW) { tx.setAttribute("textLength", maxW); tx.setAttribute("lengthAdjust", "spacingAndGlyphs"); aw = maxW; }
          e.w = aw;
        }
        e.upd = p => r.setAttribute("width", (p * (e.w + 22)).toFixed(1));
        e.head = p => [e.x + p * e.w, e.y - e.size * 0.28];
        break;
      }
      case "under": {
        if (e.line) e.w = e.line.w;
        const l = S("line", { x1: e.x, y1: e.y, x2: e.x, y2: e.y, style: `stroke:${col}`, "stroke-width": 4, "stroke-linecap": "round" }, g);
        e.upd = p => l.setAttribute("x2", (e.x + p * e.w).toFixed(1));
        e.head = p => [e.x + p * e.w, e.y];
        break;
      }
      case "box": {
        if (e.lines) e.w = Math.max(...e.lines.map(l => l.w)) + 32;
        const per = 2 * (e.w + e.h);
        const r = S("rect", { x: e.x, y: e.y, width: e.w, height: e.h, rx: 12, fill: "none", style: `stroke:${col}`, "stroke-width": 4, "stroke-dasharray": per, "stroke-dashoffset": per }, g);
        e.upd = p => r.setAttribute("stroke-dashoffset", (per * (1 - p)).toFixed(1));
        e.head = p => { let d = p * per; const { x, y, w, h } = e; if (d < w) return [x + d, y]; d -= w; if (d < h) return [x + w, y + d]; d -= h; if (d < w) return [x + w - d, y + h]; d -= w; return [x, y + h - d]; };
        break;
      }
      case "table": {
        const { x, y, cw, rh, nr, nc } = e, W = cw * nc, Ht = rh * nr;
        const bg = S("rect", { x, y, width: W, height: rh, style: "fill:var(--thead)" }, g);
        const lines = S("g", { style: `stroke:${col}`, "stroke-width": 2.4 }, g);
        for (let i = 0; i <= nr; i++) S("line", { x1: x, y1: y + i * rh, x2: x + W, y2: y + i * rh }, lines);
        for (let j = 0; j <= nc; j++) S("line", { x1: x + j * cw, y1: y, x2: x + j * cw, y2: y + Ht }, lines);
        const cells = [];
        e.cells.forEach((row, i) => row.forEach((c, j) => {
          if (c === "") return;
          const fs = e.cellSize[i][j];
          const t = S("text", { x: x + j * cw + cw / 2, y: y + i * rh + rh / 2 + fs * 0.3, "font-size": fs.toFixed(1), "text-anchor": "middle", class: "pen", style: `fill:${col}`, opacity: 0 }, g);
          t.textContent = c; cells.push(t);
        }));
        const hls = (e.hl || []).filter(([i, j]) => i < nr && j < nc).map(([i, j]) => S("ellipse", { cx: x + j * cw + cw / 2, cy: y + i * rh + rh / 2, rx: cw / 2 - 6, ry: rh / 2 - 5, fill: "none", style: "stroke:var(--c-red)", "stroke-width": 3.5, opacity: 0 }, g));
        e.upd = p => {
          const a = clamp(p / 0.15, 0, 1);
          lines.setAttribute("opacity", a); bg.setAttribute("opacity", a);
          const k = cells.length;
          cells.forEach((c, i) => c.setAttribute("opacity", p >= 0.15 + 0.75 * i / Math.max(1, k) ? 1 : 0));
          const hp = clamp((p - 0.9) / 0.1, 0, 1);
          hls.forEach(h => h.setAttribute("opacity", hp));
        };
        e.head = p => {
          if (p < 0.15) return [x + W * p / 0.15, y];
          const k = cells.length; if (!k) return null;
          const c = cells[Math.min(k - 1, Math.floor((p - 0.15) / 0.75 * k))];
          return [+c.getAttribute("x") + 12, +c.getAttribute("y") - 8];
        };
        break;
      }
      case "seg": {
        const l = S("line", { x1: e.x1, y1: e.y1, x2: e.x1, y2: e.y1, style: `stroke:${col}`, "stroke-width": e.wd, "stroke-linecap": "round" }, g);
        if (e.dash) l.setAttribute("stroke-dasharray", "14 12");
        e.upd = p => { l.setAttribute("x2", (e.x1 + (e.x2 - e.x1) * p).toFixed(1)); l.setAttribute("y2", (e.y1 + (e.y2 - e.y1) * p).toFixed(1)); };
        e.head = p => [e.x1 + (e.x2 - e.x1) * p, e.y1 + (e.y2 - e.y1) * p];
        break;
      }
      case "poly":
        S("polygon", { points: e.pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" "), style: `fill:var(--fill-${e.fill})` }, g);
        e.fade = true; e.upd = () => {};
        break;
      case "label": {
        const t = S("text", { x: e.x, y: e.y, "font-size": e.size, "text-anchor": "middle", "dominant-baseline": "central", class: "pen", style: `fill:${col}` }, g);
        t.textContent = e.txt; e.fade = true; e.upd = () => {};
        break;
      }
      case "path":
        S("path", { d: e.d, fill: "none", style: `stroke:${col}`, "stroke-width": e.wd, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
        e.fade = true; e.upd = () => {};
        break;
      case "ang":
        S("path", { d: e.d, fill: "none", style: `stroke:${col}`, "stroke-width": 3.4, "stroke-linecap": "round" }, g);
        if (e.dot) S("circle", { cx: e.dot[0], cy: e.dot[1], r: 6, style: `fill:${col}` }, g);
        e.fade = true; e.upd = () => {};
        break;
      case "dot":
        S("circle", { cx: e.x, cy: e.y, r: 6.5, style: `fill:${col}` }, g);
        e.fade = true; e.upd = () => {};
        break;
      case "circle": {
        const c = S("circle", { cx: e.x, cy: e.y, r: e.r, fill: "none", style: `stroke:${col}`, "stroke-width": 3.4 }, g);
        if (e.dash) { c.setAttribute("stroke-dasharray", "14 12"); e.fade = true; e.upd = () => {}; }
        else {
          const L = 2 * Math.PI * e.r;
          c.setAttribute("stroke-dasharray", L.toFixed(1)); c.setAttribute("transform", `rotate(-90 ${e.x} ${e.y})`);
          e.upd = p => c.setAttribute("stroke-dashoffset", (L * (1 - p)).toFixed(1));
          e.head = p => [e.x + e.r * Math.cos(-Math.PI / 2 + 2 * Math.PI * p), e.y + e.r * Math.sin(-Math.PI / 2 + 2 * Math.PI * p)];
        }
        break;
      }
      default: e.upd = () => {};
    }
  }
}

function visOf(e, t) {
  const iv = e.iv;
  for (let i = iv.length - 1; i >= 0; i--) {
    const a = iv[i][0], b = iv[i][1];
    if (t >= a && t < b) return iv[i][2] ? Math.min(1, (t - a) / 0.3) : 1;
    if (t >= b && t < b + 0.3) return 1 - (t - b) / 0.3;
  }
  return 0;
}

function render(t) {
  const comp = P.comp;
  let pen = null, pst = -1, late = null, lateEnd = -1;
  for (const e of comp.els) {
    const v = visOf(e, t), on = v > 0.002;
    if (on !== e._d) { e.g.style.display = on ? "" : "none"; e._d = on; }
    if (!on) continue;
    const p = clamp((t - e.start) / e.dur, 0, 1);
    if (p !== e._p) { e.upd(p); e._p = p; }
    const o = e.fade ? v * p : v;
    if (Math.abs(o - e._o) > 0.001) { e.g.setAttribute("opacity", o.toFixed(3)); e._o = o; }
    if (e.head) {
      if (p > 0 && p < 1) { if (e.start > pst) { pst = e.start; pen = e; } }
      else if (p >= 1) { const end = e.start + e.dur; if (t - end < 0.45 && end > lateEnd) { lateEnd = end; late = e; } }
    }
  }
  const pe = pen || late, pg = $("pen");
  const hp = pe ? pe.head(pen ? clamp((t - pe.start) / pe.dur, 0, 1) : 1) : null;
  if (hp) { pg.style.display = ""; pg.setAttribute("transform", `translate(${hp[0].toFixed(1)} ${hp[1].toFixed(1)})`); }
  else pg.style.display = "none";
  updateUI(t);
}

function updateUI(t) {
  const c = P.comp;
  for (const s of segs) { const f = clamp((t - s.ch.start) / (s.ch.end - s.ch.start), 0, 1); if (f !== s.f) { s.fill.style.width = (f * 100).toFixed(2) + "%"; s.f = f; } }
  const tt = fmtTime(t) + " / " + fmtTime(c.total);
  if (tt !== ui.time) { $("time").textContent = tt; ui.time = tt; }
  const si = stepAt(t), ci = c.steps[si].ci;
  if (ci !== ui.ci) { ui.ci = ci; $("chapName").textContent = c.chapters[ci].title; chItems.forEach((li, i) => li.classList.toggle("on", i === ci)); }
  const sub = P.ccOn && !P.ended && (P.playing || t > 0) ? c.steps[si].say : "";
  if (sub !== ui.sub) { ui.sub = sub; const el = $("subs"); el.textContent = sub; el.hidden = !sub; }
}

/* ---------- 목소리 ----------
   AI 목소리: Gemini·OpenAI 음성 모델로 단계마다 음성을 만들어 이 기기에 저장해 두고 재생해요.
   기기 목소리: 휴대폰에 들어 있는 목소리(speechSynthesis). AI 목소리를 못 쓸 때 대신 써요. */
const VS = { mode: store.get("voiceMode", "ai"), aiVoice: store.get("aiVoice", {}) || {}, deviceName: store.get("deviceVoice", ""), server: null, fails: 0, aiRestUntil: 0, gemModel: store.get("gemTts", "") };
const AI_VOICES = {
  gemini: [["Sulafat", "따뜻한 목소리"], ["Achird", "친근한 목소리"], ["Vindemiatrix", "부드러운 목소리"], ["Kore", "또렷한 목소리"], ["Charon", "차분하게 설명하는 목소리"], ["Puck", "밝은 목소리"]],
  openai: [["coral", "따뜻한 목소리"], ["sage", "차분한 목소리"], ["nova", "밝은 목소리"], ["shimmer", "부드러운 목소리"], ["ash", "또렷한 목소리"], ["onyx", "낮은 목소리"]]
};
const GEM_TTS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];
const OAI_TTS_INSTR = "Speak natural Korean like a warm, friendly middle-school math teacher explaining a problem step by step to one student. Calm, clear and encouraging, with natural pauses.";
const VOICE_SAMPLE = "안녕! 오늘도 칠판에 같이 풀어 보자. 그림에서 이게 보이지?";

function aiSource() {
  if (VS.server && VS.server.ok && API_BASE != null) return { via: "server", provider: VS.server.provider };
  if (devAI && devAI.key && (devAI.provider === "gemini" || devAI.provider === "openai")) return { via: "direct", provider: devAI.provider };
  if (puterReady()) return { via: "puter", provider: "openai" };
  return null;
}
function aiVoiceName(provider) { const list = AI_VOICES[provider]; const v = VS.aiVoice[provider]; return list.some(x => x[0] === v) ? v : list[0][0]; }
function aiVoiceDesc(provider, name) { const f = AI_VOICES[provider].find(x => x[0] === name); return f ? f[1] : name; }
const useAI = () => VS.mode === "ai" && !!aiSource() && performance.now() > VS.aiRestUntil;
function voiceUsable() { return P.voiceOn && (useAI() || (!!VOICE.kind && performance.now() > P.restUntil)); }

/* ---------- 버튼 한 번으로 AI 연결 (Puter) ----------
   키 없이 Puter 계정으로 로그인만 하면 AI(사진 읽기·대본 쓰기)와 AI 목소리를 써요.
   사용량은 로그인한 사람의 Puter 계정에서 나가요 (매달 무료 사용량이 있어요). */
const PUTER_SRC = "https://js.puter.com/v2/";
// 빠른 순서: 생각을 짧게 하도록 reasoning_effort를 낮춰요. 마지막 "" = Puter 기본 모델
const PUTER_CHAT_MODELS = [
  { model: "gemini-3-flash-preview", reasoning_effort: "low" },
  { model: "gemini-3.1-flash-lite", reasoning_effort: "low" },
  { model: "gemini-flash-latest" },
  { model: "" }
];
const PUTER_STALL_MS = window.__stallMs || 120000;   // 이만큼 아무것도 안 오면 다음 모델로
let genChars = 0;
let puterP = null, puterOn = !!store.get("puter", false), puterBusy = false, pendingConnectGen = false, puterErr = "";
// 로그인 창(새 창)이 열리지 않는 곳: 카카오톡 같은 앱 안 브라우저, 아이폰 홈 화면 앱
const UA = navigator.userAgent || "";
const IS_IOS = /iPhone|iPad|iPod/i.test(UA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const IN_APP = /KAKAOTALK/i.test(UA) ? "카카오톡" : /NAVER\(inapp|; NAVER/i.test(UA) ? "네이버 앱" : /Instagram/i.test(UA) ? "인스타그램" : /FBAN|FBAV|FB_IAB/i.test(UA) ? "페이스북" : /\bLine\//i.test(UA) ? "라인" : /DaumApps/i.test(UA) ? "다음 앱" : /BAND\//i.test(UA) ? "밴드" : /everytimeApp/i.test(UA) ? "에브리타임" : "";
const IS_STANDALONE = (() => { try { return navigator.standalone === true || matchMedia("(display-mode: standalone)").matches; } catch (e) { return false; } })();
const PUTER_ERR = {
  popup_blocked: "로그인 창이 열리지 않았어요. 브라우저가 새 창을 막았어요.",
  auth_window_closed: "로그인 창이 닫혀서 연결되지 않았어요. 다시 눌러서 로그인을 끝까지 해 주세요.",
  unsupported_origin: "파일로 열면 연결할 수 없어요. 앱 주소로 열어 주세요.",
  auth_timeout: "로그인을 기다리다 시간이 지났어요.",
  not_signed_in: "로그인이 끝나지 않았어요."
};
function openInBrowser() {
  const url = location.href;
  if (/KAKAOTALK/i.test(UA)) { location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(url); return; }
  if (/Android/i.test(UA)) { location.href = "intent://" + location.host + location.pathname + location.search + location.hash + "#Intent;scheme=https;package=com.android.chrome;end"; return; }
  copyText(url).then(ok => toast(ok ? "주소를 복사했어요. 사파리를 열고 주소창에 붙여 넣어 주세요." : "오른쪽 위 메뉴에서 ‘Safari로 열기’를 눌러 주세요."));
}
async function copyText(t) {
  try { await Promise.race([navigator.clipboard.writeText(t), new Promise((_, r) => setTimeout(r, 1500))]); return true; } catch (e) {}
  try { const ta = H("textarea", null, t); document.body.append(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok; } catch (e) { return false; }
}
function loadPuter() {
  if (window.puter && window.puter.ai) return Promise.resolve(window.puter);
  if (puterP) return puterP;
  puterP = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = PUTER_SRC; s.async = true;
    const tm = setTimeout(() => { puterP = null; rej(new Error("AI 연결 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.")); }, 20000);
    s.onload = () => { clearTimeout(tm); window.puter && window.puter.ai ? res(window.puter) : (puterP = null, rej(new Error("AI 연결 도구를 불러오지 못했어요."))); };
    s.onerror = () => { clearTimeout(tm); puterP = null; s.remove(); rej(new Error("AI 연결 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.")); };
    document.head.appendChild(s);
  });
  return puterP;
}
function puterSignedIn() { try { return !!(window.puter && window.puter.auth && window.puter.auth.isSignedIn()); } catch (e) { return false; } }
const puterReady = () => puterOn && puterSignedIn();
// 앱을 열 때: 전에 연결했으면 조용히 다시 확인하고, 아니면 버튼을 누를 때 바로 열리게 미리 불러 둬요
function warmPuter() {
  loadPuter().then(() => {
    if (puterOn && !puterSignedIn()) { puterOn = false; store.set("puter", false); }
    renderAINote(); updateVoiceBar();
  }, () => {});
}
function errText(e) {
  if (!e) return "";
  if (typeof e === "string") return e;
  const m = e.message || (e.error && (e.error.message || e.error.code || e.error)) || e.code || "";
  if (m) return String(m);
  try { return JSON.stringify(e); } catch (x) { return String(e); }
}
function finishConnect() {
  puterBusy = false; puterErr = "";
  puterOn = true; store.set("puter", true);
  VS.aiRestUntil = 0; VS.fails = 0;
  toast("AI에 연결됐어요. 이제 사진만 찍으면 강의를 만들어요.");
  renderAINote(); updateVoiceBar();
  if ($("voiceModal") && !$("voiceModal").hidden) renderVoiceSheet();
  if (pendingConnectGen && (genImg || $("qText").value.trim())) { pendingConnectGen = false; hideErr(); generate(); }
}
async function connectPuter() {
  if (puterBusy) return;
  puterErr = ""; puterBusy = true; renderAINote();
  const stuck = setTimeout(() => {
    if (!puterBusy) return;
    puterBusy = false;
    puterErr = "로그인 창에서 연결이 끝나지 않았어요. 다시 눌러 주세요." + (IN_APP || IS_STANDALONE ? "" : " 계속 이러면 크롬이나 사파리에서 열어 주세요.");
    renderAINote();
  }, 120000);
  try {
    const pt = (window.puter && window.puter.auth) ? window.puter : await loadPuter();
    if (!puterSignedIn()) await pt.auth.signIn();
    clearTimeout(stuck);
    if (!puterSignedIn()) throw { error: "not_signed_in" };
    finishConnect();
  } catch (e) {
    clearTimeout(stuck);
    if (puterSignedIn()) { finishConnect(); return; }
    puterBusy = false;
    const code = e && typeof e.error === "string" ? e.error : (e && typeof e.code === "string" ? e.code : "");
    const m = errText(e);
    puterErr = (PUTER_ERR[code] || (/불러오지/.test(m) ? m : "연결하지 못했어요.")) + (code ? " (" + code + ")" : m && !/불러오지/.test(m) ? " (" + m.slice(0, 80) + ")" : "");
    if (code !== "unsupported_origin" && !IN_APP && !IS_STANDALONE) puterErr += " 계속 안 되면 크롬이나 사파리에서 열어 주세요.";
    renderAINote();
    setTimeout(() => { const n = $("aiNote"); if (n) n.scrollIntoView({ behavior: "smooth", block: "center" }); }, 80);
  }
}
// 로그인 창에서 돌아왔을 때 연결이 끝났는지 다시 봐요
document.addEventListener("visibilitychange", () => { if (!document.hidden && puterBusy && puterSignedIn()) finishConnect(); });
function disconnectPuter() {
  puterOn = false; store.set("puter", false);
  try { if (window.puter && window.puter.auth) window.puter.auth.signOut(); } catch (e) {}
  renderAINote(); updateVoiceBar(); toast("AI 연결을 끊었어요.");
}
const withAbort = (p, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) { rej(new DOMException("그만둠", "AbortError")); return; }
  const on = () => rej(new DOMException("그만둠", "AbortError"));
  if (signal) signal.addEventListener("abort", on, { once: true });
  p.then(v => { if (signal) signal.removeEventListener("abort", on); res(v); }, e => { if (signal) signal.removeEventListener("abort", on); rej(e); });
});
function puterOut(r) {
  if (r == null) return "";
  if (typeof r === "string") return r;
  const c = r.message ? r.message.content : (r.content != null ? r.content : r.text);
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map(x => typeof x === "string" ? x : (x && (x.text || ""))).join("");
  const s = String(r);
  return s === "[object Object]" ? "" : s;
}
function friendlyPuter(e) {
  const m = errText(e);
  if (/insufficient|funds|credit|quota|usage|limit|upgrade|balance/i.test(m)) return "Puter 무료 사용량을 이번 달에 다 썼어요. 다음 달에 다시 쓰거나, Puter 계정의 요금제를 확인해 주세요.";
  if (/auth|sign|login|token|401|403/i.test(m)) { puterOn = false; store.set("puter", false); renderAINote(); return "AI 연결이 끊겼어요. 위의 ‘AI 연결하기’를 다시 눌러 주세요."; }
  if (/network|fetch|connect|offline/i.test(m)) return "AI에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.";
  return "AI가 강의를 만들지 못했어요. 다시 한 번 눌러 주세요." + (m ? " (" + m.slice(0, 120) + ")" : "");
}
const withTimeout = (p, ms) => new Promise((res, rej) => {
  const t = setTimeout(() => rej({ error: "stall" }), ms);
  p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); });
});
async function readPuter(resp, signal) {
  if (!resp || typeof resp[Symbol.asyncIterator] !== "function") return puterOut(resp);
  const it = resp[Symbol.asyncIterator]();
  let out = "";
  try {
    while (true) {
      const r = await withAbort(withTimeout(it.next(), PUTER_STALL_MS), signal);
      if (r.done) break;
      const part = r.value;
      if (!part) continue;
      if (part.type === "error") throw { error: { message: part.message || "stream error" } };
      if (typeof part.text === "string" && (part.type === "text" || !part.type)) { out += part.text; genChars = out.length; }
    }
  } catch (e) { try { it.return && it.return(); } catch (x) {} throw e; }
  return out;
}
async function callPuter(prompt, blob, signal) {
  const pt = await loadPuter();
  if (!puterSignedIn()) { puterOn = false; store.set("puter", false); renderAINote(); throw new Error("AI 연결이 끊겼어요. 위의 ‘AI 연결하기’를 다시 눌러 주세요."); }
  const file = blob ? new File([blob], "problem.jpg", { type: blob.type || "image/jpeg" }) : null;
  const saved = store.get("puterModel2", null);
  const models = saved != null ? [PUTER_CHAT_MODELS[saved], ...PUTER_CHAT_MODELS.filter((_, i) => i !== saved)].filter(Boolean) : PUTER_CHAT_MODELS;
  let last = null;
  for (const m of models) {
    const opt = { stream: true, temperature: 0.4 };
    if (m.model) opt.model = m.model;
    if (m.reasoning_effort) opt.reasoning_effort = m.reasoning_effort;
    genChars = 0;
    try {
      const resp = await withAbort(withTimeout(file ? pt.ai.chat(prompt, file, false, opt) : pt.ai.chat(prompt, opt), PUTER_STALL_MS), signal);
      const out = await readPuter(resp, signal);
      if (out && /[{]/.test(out)) { store.set("puterModel2", PUTER_CHAT_MODELS.indexOf(m)); return { text: out, provider: "Puter", model: m.model || "기본 모델" }; }
      last = new Error("빈 답이 왔어요");
    } catch (e) {
      if (signal && signal.aborted) throw e;
      last = e;
      if (/insufficient|funds|credit|quota|upgrade|balance|auth|sign|login|token/i.test(errText(e))) break;
    }
  }
  if (last && last.error === "stall") throw new Error("AI가 너무 오래 답하지 않아요. 잠시 뒤 다시 눌러 주세요.");
  throw new Error(friendlyPuter(last));
}
/* 기기 목소리 */
function initWebVoice() {
  if (!("speechSynthesis" in window)) return;
  const pick = () => {
    let vs = [];
    try { vs = speechSynthesis.getVoices() || []; } catch (e) {}
    const ko = vs.filter(v => /^ko/i.test(v.lang));
    const score = v => (/premium|enhanced|neural|natural|online|wavenet/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 3 : 0) + (/yuna|sora|heami|jiyoung|sunhi/i.test(v.name) ? 2 : 0) + (v.localService === false ? 1 : 0);
    VOICE.koList = ko.slice().sort((x, y) => score(y) - score(x));
    VOICE.ko = VOICE.koList.find(v => v.name === VS.deviceName) || VOICE.koList[0] || null;
    VOICE.web = !!VOICE.ko || vs.length === 0;
    VOICE.kind = VOICE.web ? "web" : null;
    syncButtons();
  };
  pick();
  try { speechSynthesis.addEventListener("voiceschanged", pick); } catch (e) {}
}
let speechUnlocked = false;
function unlockSpeech() {
  if (speechUnlocked || !("speechSynthesis" in window)) return;
  speechUnlocked = true;
  try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; u.lang = "ko-KR"; speechSynthesis.speak(u); } catch (e) {}
}
function webSpeak(text, tok, fin, voice) {
  if (VOICE.kind !== "web") { fin(); return; }
  try {
    speechSynthesis.cancel();
    // 긴 문장은 문장별로 나눠 읽어요 (일부 브라우저가 긴 문장을 중간에 끊어서)
    const parts = (text.match(/[^.!?…]+[.!?…]*\s*/g) || [text]).map(s => s.trim()).filter(Boolean);
    parts.forEach((s, i) => {
      const u = new SpeechSynthesisUtterance(s);
      u.lang = "ko-KR"; const v = voice || VOICE.ko; if (v) u.voice = v;
      u.rate = clamp(P.speed * 0.97, 0.5, 2);
      if (i === 0) u.onstart = () => { P.voiceFails = 0; if (tok == null || P.sp.tok === tok) { P.sp.started = true; setVoiceWait(false); } };
      if (i === parts.length - 1) u.onend = fin;
      u.onerror = ev => { if (!ev || ev.error !== "interrupted") fin(); };
      speechSynthesis.speak(u);
    });
  } catch (e) { fin(); }
}

/* AI 목소리: 만들기 + 이 기기에 저장 */
const clipMem = new Map(), clipPending = new Map();
let idbP = null;
function idb() {
  if (idbP) return idbP;
  idbP = new Promise(res => {
    try { const r = indexedDB.open("chalk-audio", 1); r.onupgradeneeded = () => r.result.createObjectStore("clips"); r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null); }
    catch (e) { res(null); }
  });
  return idbP;
}
async function idbGet(k) { const d = await idb(); if (!d) return null; return new Promise(res => { try { const q = d.transaction("clips").objectStore("clips").get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } }); }
async function idbPut(k, v) { const d = await idb(); if (!d) return; try { d.transaction("clips", "readwrite").objectStore("clips").put(v, k); } catch (e) {} }
let ttsActive = 0;
const ttsQueue = [];
function ttsSlot(priority) {
  return new Promise(r => {
    const go = () => { ttsActive++; r(() => { ttsActive--; const n = ttsQueue.shift(); if (n) n(); }); };
    if (ttsActive < 2) go(); else if (priority) ttsQueue.unshift(go); else ttsQueue.push(go);
  });
}
function ttsErr(status, msg) { const e = new Error(msg || ("HTTP " + status)); e.status = status; return e; }
function b64bytes(b64) { const s = atob(b64), out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
function pcmToWav(pcm, rate) {
  const h = new DataView(new ArrayBuffer(44));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) h.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); h.setUint32(4, 36 + pcm.length, true); w(8, "WAVE"); w(12, "fmt "); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true);
  h.setUint32(24, rate, true); h.setUint32(28, rate * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true); w(36, "data"); h.setUint32(40, pcm.length, true);
  return new Blob([h.buffer, pcm], { type: "audio/wav" });
}
function audioBlob(b64, mime) {
  const bytes = b64bytes(b64);
  const isWav = /wav/i.test(mime) || (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46);
  if (isWav) return new Blob([bytes], { type: "audio/wav" });
  if (/mpeg|mp3/i.test(mime)) return new Blob([bytes], { type: "audio/mpeg" });
  const m = /rate=(\d+)/i.exec(mime || "");
  return pcmToWav(bytes, m ? +m[1] : 24000);
}
async function synth(src, voice, text) {
  if (src.via === "server") {
    const r = await fetch(API_BASE + "/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, voice }) });
    if (!r.ok) { let j = {}; try { j = await r.json(); } catch (e) {} throw ttsErr(r.status, j.error); }
    return await r.blob();
  }
  if (src.via === "puter") {
    let audio;
    try { audio = await window.puter.ai.txt2speech(text, { provider: "openai", model: "gpt-4o-mini-tts", voice, instructions: OAI_TTS_INSTR }); }
    catch (e) { const m = errText(e); throw ttsErr(/insufficient|funds|credit|quota|limit|upgrade|balance|too many/i.test(m) ? 429 : /auth|sign|login|token/i.test(m) ? 401 : 500, m); }
    const url = audio && (audio.src || audio.currentSrc);
    if (!url) throw ttsErr(500, "빈 음성이 왔어요");
    const r = await fetch(url);
    if (!r.ok) throw ttsErr(r.status, "음성을 받지 못했어요");
    return await r.blob();
  }
  if (src.provider === "openai") {
    const r = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + devAI.key },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice, input: text, instructions: OAI_TTS_INSTR, response_format: "mp3" }) });
    if (!r.ok) { let j = {}; try { j = await r.json(); } catch (e) {} throw ttsErr(r.status, j.error && j.error.message); }
    return await r.blob();
  }
  const models = VS.gemModel ? [VS.gemModel, ...GEM_TTS.filter(m => m !== VS.gemModel)] : GEM_TTS;
  let last = null;
  for (const m of models) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(devAI.key)}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } })
    });
    let j = {};
    try { j = await r.json(); } catch (e) {}
    const msg = j.error && j.error.message;
    if (r.ok) {
      const parts = ((((j.candidates || [])[0] || {}).content) || {}).parts || [];
      const inl = parts.map(p => p.inlineData || p.inline_data).find(x => x && x.data);
      if (inl) { if (VS.gemModel !== m) { VS.gemModel = m; store.set("gemTts", m); } return audioBlob(inl.data, inl.mimeType || inl.mime_type || ""); }
      last = ttsErr(500, "빈 음성이 왔어요"); continue;
    }
    last = ttsErr(r.status, msg);
    if (r.status === 401 || r.status === 403 || r.status === 429 || (r.status === 400 && /api key/i.test(msg || ""))) throw last;
  }
  throw last || ttsErr(500, "음성을 만들지 못했어요");
}
function getClip(text, priority, voiceOverride) {
  const src = aiSource();
  if (!src) return Promise.reject(ttsErr(0, "AI 목소리를 쓸 수 없어요"));
  const voice = voiceOverride || aiVoiceName(src.provider);
  const k = src.provider + "|" + voice + "|" + hashCode(text) + "|" + text.length;
  if (clipMem.has(k)) return Promise.resolve(clipMem.get(k));
  if (clipPending.has(k)) return clipPending.get(k);
  const p = (async () => {
    const cached = await idbGet(k);
    if (cached && cached.blob) { const c = { blob: cached.blob, url: URL.createObjectURL(cached.blob) }; clipMem.set(k, c); return c; }
    const release = await ttsSlot(priority);
    try {
      const blob = await synth(src, voice, text);
      const c = { blob, url: URL.createObjectURL(blob) };
      clipMem.set(k, c); idbPut(k, { blob });
      return c;
    } finally { release(); }
  })();
  clipPending.set(k, p);
  p.then(() => clipPending.delete(k), () => clipPending.delete(k));
  return p;
}
function prefetchFrom(i, n) {
  if (!useAI() || !P.comp) return;
  const st = P.comp.steps;
  for (let j = i; j < Math.min(st.length, i + (n || 3)); j++) if (st[j].say) getClip(st[j].say, false).catch(() => {});
}
function aiFail(err) {
  const s = err && err.status;
  if (s === 401 || s === 403 || (s === 400 && /api key/i.test(err.message || ""))) { VS.aiRestUntil = Infinity; toast("AI 목소리 키가 맞지 않아서 기기 목소리로 읽어 줄게요."); }
  else if (s === 429) { VS.aiRestUntil = performance.now() + 60000; toast("AI 목소리 사용량 한도에 걸려서 1분 동안 기기 목소리로 읽어 줄게요."); }
  else if (++VS.fails >= 2) { VS.fails = 0; VS.aiRestUntil = performance.now() + 120000; toast("AI 목소리를 만들지 못해서 잠깐 기기 목소리로 읽어 줄게요."); }
  updateVoiceBar();
}

/* 재생 */
const audioEl = new Audio();
audioEl.preload = "auto";
let audioUnlocked = false;
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try { audioEl.src = SILENT_WAV; const p = audioEl.play(); if (p) p.catch(() => {}); } catch (e) {}
}
function setVoiceWait(on) { const w = $("vwait"); if (w && w.hidden === !!on) w.hidden = !on; }
function playClip(clip, tok) {
  const fallback = () => { if (P.sp.tok === tok && !P.sp.done) { P.sp.ai = false; webSpeak(P.comp.steps[P.sp.step].say, tok, P.sp.fin); } };
  try {
    audioEl.onplaying = () => { if (P.sp.tok === tok) { P.sp.started = true; setVoiceWait(false); } };
    audioEl.onended = () => { if (P.sp.tok === tok) P.sp.fin(); };
    audioEl.onerror = fallback;
    audioEl.src = clip.url;
    audioEl.defaultPlaybackRate = P.speed; audioEl.playbackRate = P.speed;
    const p = audioEl.play();
    if (p) p.catch(e => { if (!e || e.name !== "AbortError") fallback(); });
  } catch (e) { fallback(); }
}
function speakStep(si, now) {
  const tok = P.sp.tok + 1;
  const fin = () => { if (P.sp.tok === tok) { P.sp.done = true; P.sp.started = true; setVoiceWait(false); } };
  P.sp = { step: si, tok, started: false, done: false, at: now, hold: 0, paused: false, ai: false, fin, clip: null };
  const text = P.comp.steps[si].say;
  if (!text) { fin(); return; }
  if (useAI()) {
    P.sp.ai = true; setVoiceWait(true);
    getClip(text, true).then(clip => {
      if (P.sp.tok !== tok || !P.sp.ai) return;
      VS.fails = 0; P.sp.clip = clip;
      if (P.playing) playClip(clip, tok); else P.sp.paused = true;
    }, err => {
      if (P.sp.tok !== tok || !P.sp.ai) return;
      aiFail(err);
      P.sp.ai = false; P.sp.at = performance.now();
      webSpeak(text, tok, fin);
    });
    prefetchFrom(si + 1, 3);
    return;
  }
  webSpeak(text, tok, fin);
}
function stopSpeech() {
  const wasActive = !P.sp.done;
  P.sp = { step: -1, tok: P.sp.tok + 1, started: true, done: true, at: 0, hold: 0, paused: false, ai: false, fin: () => {}, clip: null };
  setVoiceWait(false);
  try { audioEl.onended = null; audioEl.onplaying = null; audioEl.onerror = null; audioEl.pause(); } catch (e) {}
  if (wasActive && "speechSynthesis" in window) { try { speechSynthesis.cancel(); } catch (e) {} }
}

/* 목소리 고르기 */
const previewEl = new Audio();
function voiceLabel() {
  if (!P.voiceOn) return "꺼짐 (자막만)";
  const src = aiSource();
  if (VS.mode === "ai" && src) return "AI 목소리 · " + aiVoiceDesc(src.provider, aiVoiceName(src.provider)) + (performance.now() <= VS.aiRestUntil ? " (잠시 기기 목소리)" : "");
  if (VOICE.kind) return "기기 목소리" + (VOICE.ko ? " · " + VOICE.ko.name : "");
  return "없음 (자막으로 봐 주세요)";
}
function updateVoiceBar() { const l = $("voiceLabel"); if (l) l.textContent = voiceLabel(); }
function stopPreview() { try { previewEl.pause(); } catch (e) {} try { speechSynthesis.cancel(); } catch (e) {} document.querySelectorAll(".vitem.loading").forEach(x => x.classList.remove("loading")); }
function previewAI(name, btnRow) {
  stopPreview(); if (P.playing) pause();
  btnRow.classList.add("loading");
  getClip(VOICE_SAMPLE, true, name).then(c => { btnRow.classList.remove("loading"); previewEl.src = c.url; previewEl.play().catch(() => {}); },
    e => { btnRow.classList.remove("loading"); toast(e && (e.status === 401 || e.status === 403) ? "키가 맞지 않아요. AI 키를 다시 확인해 주세요." : e && e.status === 429 ? "AI 목소리 사용량 한도에 걸렸어요. 잠시 뒤 다시 해 주세요." : "AI 목소리를 만들지 못했어요."); });
}
function renderVoiceSheet() {
  const src = aiSource(), ai = VS.mode === "ai";
  $("vmAI").classList.toggle("on", ai); $("vmDev").classList.toggle("on", !ai);
  $("vAIBox").hidden = !ai; $("vDevBox").hidden = ai;
  const note = $("vAINote"), list = $("vAIList");
  list.textContent = "";
  if (!src) {
    note.textContent = "AI 목소리는 AI에 연결하면 쓸 수 있어요. 버튼 한 번이면 돼요.";
    list.append(H("button", { class: "btn primary connbtn", onclick: connectPuter }, puterBusy ? "연결하는 중…" : "AI 연결하기"));
  } else {
    note.textContent = (src.via === "puter" ? "Puter로 연결한 OpenAI" : src.provider === "gemini" ? "Google Gemini" : "OpenAI") + " 목소리예요. 처음 읽을 때 한 번 만들어서 이 기기에 저장해 두고, 다음부터는 바로 재생해요.";
    const cur = aiVoiceName(src.provider);
    for (const [name, desc] of AI_VOICES[src.provider]) {
      const row = H("div", { class: "vitem" + (name === cur ? " on" : "") },
        H("button", { class: "vpick", onclick: () => { VS.aiVoice[src.provider] = name; store.set("aiVoice", VS.aiVoice); renderVoiceSheet(); updateVoiceBar(); if (P.comp) { stopSpeech(); P.t = P.comp.steps[stepAt(P.t)].start; P.dirty = true; } } }, H("b", null, desc), H("small", null, name)),
        H("button", { class: "vplay", "aria-label": desc + " 미리 듣기", onclick: e => previewAI(name, e.currentTarget.parentNode) }, "▶ 듣기"));
      list.append(row);
    }
  }
  const dl = $("vDevList");
  dl.textContent = "";
  if (!VOICE.koList || !VOICE.koList.length) dl.append(H("p", { class: "vnote" }, "이 기기에서 한국어 목소리를 찾지 못했어요. 휴대폰 설정 → 텍스트 음성 변환(TTS)에서 한국어 음성을 내려받으면 쓸 수 있어요."));
  else for (const v of VOICE.koList.slice(0, 8)) {
    const row = H("div", { class: "vitem" + (VOICE.ko === v ? " on" : "") },
      H("button", { class: "vpick", onclick: () => { VOICE.ko = v; VS.deviceName = v.name; store.set("deviceVoice", v.name); renderVoiceSheet(); updateVoiceBar(); } }, H("b", null, v.name), H("small", null, v.localService === false ? "인터넷 목소리" : "기기 안 목소리")),
      H("button", { class: "vplay", onclick: () => { stopPreview(); if (P.playing) pause(); webSpeak(VOICE_SAMPLE, null, () => {}, v); } }, "▶ 듣기"));
    dl.append(row);
  }
}
function openVoiceSheet() { if (P.playing) pause(); renderVoiceSheet(); $("voiceModal").hidden = false; }
function closeVoiceSheet() { stopPreview(); $("voiceModal").hidden = true; updateVoiceBar(); syncButtons(); }
function wireVoice() {
  $("bVoiceSet").onclick = openVoiceSheet;
  $("bVoiceDone").onclick = closeVoiceSheet;
  $("voiceModal").addEventListener("click", e => { if (e.target === $("voiceModal")) closeVoiceSheet(); });
  $("vmAI").onclick = () => { VS.mode = "ai"; store.set("voiceMode", "ai"); VS.aiRestUntil = 0; renderVoiceSheet(); };
  $("vmDev").onclick = () => { VS.mode = "device"; store.set("voiceMode", "device"); renderVoiceSheet(); };
  checkAI();
  if (puterOn) warmPuter();
}

/* ---------- 재생 ---------- */
function play() {
  if (!P.comp) return;
  unlockSpeech(); unlockAudio();
  if (P.ended || P.t >= P.comp.total - 0.01) seekTo(0);
  P.ended = false; P.playing = true;
  $("ovStart").hidden = true; $("ovEnd").hidden = true;
  if (P.sp.paused && P.sp.ai && !P.sp.done) {
    P.sp.paused = false;
    if (P.sp.clip && audioEl.src === P.sp.clip.url && audioEl.currentTime > 0 && !audioEl.ended) audioEl.play().catch(() => {});
    else if (P.sp.clip) playClip(P.sp.clip, P.sp.tok);
  }
  P.last = 0; P.dirty = true;
  syncButtons();
}
function pause() {
  if (!P.playing) return;
  P.playing = false;
  if (!P.sp.done) {
    if (P.sp.ai) { try { audioEl.pause(); } catch (e) {} P.sp.paused = true; }
    else { stopSpeech(); if (P.comp) P.t = P.comp.steps[stepAt(P.t)].start; }
  }
  P.dirty = true;
  syncButtons();
}
function toggle() { P.playing ? pause() : play(); }
function seekTo(t) {
  stopSpeech();
  const c = P.comp;
  t = clamp(t, 0, c.total);
  if (voiceUsable() && t < c.total - 0.01) t = c.steps[stepAt(t)].start;
  P.t = t; P.ended = false; P.dirty = true;
  $("ovEnd").hidden = true;
  if (t > 0) $("ovStart").hidden = true;
}
function finish() {
  P.playing = false; P.ended = true; P.t = P.comp.total;
  stopSpeech();
  $("ovEnd").hidden = false;
  syncButtons();
}
function loop(now) {
  requestAnimationFrame(loop);
  const c = P.comp;
  if (!c) { P.last = now; return; }
  const dt = P.last ? Math.min(0.1, (now - P.last) / 1000) : 0;
  P.last = now;
  if (P.playing && !P.drag) {
    const si = stepAt(P.t), st = c.steps[si], end = st.start + st.dur;
    let adv = dt * P.speed;
    if (voiceUsable()) {
      if (P.sp.step !== si) speakStep(si, now);
      const sp = P.sp;
      const wait = sp.ai ? 20000 : 3500;
      if (!sp.started && !sp.done) {
        if (now - sp.at < wait) adv = 0;
        else if (sp.ai) { sp.ai = false; sp.at = now; aiFail({ status: 0 }); webSpeak(st.say, sp.tok, sp.fin); adv = 0; }
        else {
          sp.done = true;
          if (VOICE.kind === "web" && ++P.voiceFails >= 2) { VOICE.kind = null; toast("이 기기에서는 목소리가 나오지 않아서 자막으로 보여 줄게요."); syncButtons(); }
        }
      } else if (!sp.done && P.t + adv >= end - 0.02) {
        adv = Math.max(0, end - 0.02 - P.t);
        if (!sp.hold) sp.hold = now; else if (now - sp.hold > 15000) sp.done = true;
      }
    }
    P.t = Math.min(c.total, P.t + adv);
    if (P.t >= c.total - 1e-6) finish();
  }
  if (P.t !== P.drawnT || P.dirty) { render(P.t); P.drawnT = P.t; P.dirty = false; }
}

function syncButtons() {
  $("bPlay").innerHTML = P.playing ? ICON.pause : ICON.play;
  $("bPlay").setAttribute("aria-label", P.playing ? "일시정지" : "재생");
  const vb = $("bVoice");
  vb.innerHTML = voiceUsable() ? ICON.vol : ICON.mute;
  vb.classList.toggle("off", !VOICE.kind);
  vb.title = !VOICE.kind ? "이 화면에서는 목소리를 쓸 수 없어요 (자막으로 봐 주세요)" : P.voiceOn ? "목소리 끄기 (M)" : "목소리 켜기 (M)";
  updateVoiceBar();
  $("bCC").innerHTML = ICON.cc;
  $("bCC").classList.toggle("off", !P.ccOn);
  $("bCC").title = P.ccOn ? "자막 끄기 (C)" : "자막 켜기 (C)";
  $("bSpeed").textContent = P.speed + "x";
  $("bTheme").textContent = P.theme === "note" ? "공책" : "칠판";
  $("stage").className = "stage theme-" + P.theme;
}

function buildProgress() {
  const pr = $("prog");
  pr.querySelectorAll(".seg").forEach(n => n.remove());
  segs = P.comp.chapters.map(ch => {
    const s = H("div", { class: "seg" });
    s.style.flex = `${(ch.end - ch.start).toFixed(2)} 1 0`;
    const i = H("i"); s.append(i); pr.append(s);
    return { el: s, fill: i, ch, f: -1 };
  });
}
function tFromX(x) {
  for (let i = 0; i < segs.length; i++) {
    const r = segs[i].el.getBoundingClientRect();
    if (x <= r.right || i === segs.length - 1) { const ch = segs[i].ch; return ch.start + clamp((x - r.left) / r.width, 0, 1) * (ch.end - ch.start); }
  }
  return 0;
}

function openLecture(L) {
  if (P.lec && P.lec.id === L.id && P.comp) { P.dirty = true; syncButtons(); return; }
  stopSpeech(); P.playing = false;
  P.lec = L;
  P.comp = compileLecture(L, measure);
  P.compFonts = fontsReady;
  mount(P.comp);
  P.t = 0; P.ended = false; P.dirty = true; ui = {};
  $("ovStart").hidden = false; $("ovEnd").hidden = true;
  $("ovTitle").textContent = L.title;
  $("ovSub").textContent = "강의 시작 · " + fmtTime(P.comp.total) + (useAI() ? " · AI 목소리" : VOICE.kind ? "" : " · 자막으로 진행");
  buildProgress();
  const list = $("chlist"); list.textContent = "";
  chItems = P.comp.chapters.map((ch, i) => {
    const li = H("li", null, H("button", { onclick: () => { seekTo(ch.start); play(); window.scrollTo({ top: 0, behavior: "smooth" }); } }, H("span", { class: "ct" }, fmtTime(ch.start)), H("span", null, (i + 1) + ". " + ch.title)));
    list.append(li); return li;
  });
  setTimeout(() => prefetchFrom(0, 2), 400);
  $("pTitle").textContent = L.title;
  $("pMeta").textContent = [L.unit, fmtTime(P.comp.total) + " 강의", "챕터 " + P.comp.chapters.length + "개"].filter(Boolean).join(" · ");
  $("pAnswer").hidden = true;
  $("pAnswer").textContent = "";
  if (L.answer) $("pAnswer").append(H("div", null, H("b", null, "정답 "), L.answer));
  if (L.tip) $("pAnswer").append(H("div", null, H("b", null, "요령 "), L.tip));
  $("bAnswer").hidden = !(L.answer || L.tip);
  $("bAnswer").textContent = "정답 보기";
  const del = $("bDel");
  del.hidden = L.origin !== "mine";
  del.textContent = "강의 삭제"; del.dataset.arm = "";
  $("bSave").hidden = L.origin !== "shared";
  if (L.ai) $("pMeta").textContent += " · " + L.ai;
  syncButtons();
}
function leavePlayer() { if (P.playing) pause(); stopSpeech(); }

/* ---------- 컨트롤 연결 ---------- */
function wireControls() {
  $("bigPlay").onclick = play;
  $("bPlay").onclick = toggle;
  $("bReplay").onclick = () => { seekTo(0); play(); };
  $("board").addEventListener("click", () => { if (!$("ovStart").hidden) return; toggle(); });
  $("bPrev").innerHTML = ICON.prev; $("bNext").innerHTML = ICON.next;
  $("bPrev").onclick = () => { const ci = chapterAt(P.t), ch = P.comp.chapters[ci]; seekTo(P.t - ch.start > 2 || ci === 0 ? ch.start : P.comp.chapters[ci - 1].start); };
  $("bNext").onclick = () => { const ci = chapterAt(P.t); if (ci < P.comp.chapters.length - 1) seekTo(P.comp.chapters[ci + 1].start); };
  $("bVoice").onclick = () => {
    if (!VOICE.kind) { toast("이 화면에서는 목소리를 쓸 수 없어요. 자막으로 봐 주세요."); return; }
    P.voiceOn = !P.voiceOn; store.set("voice", P.voiceOn);
    stopSpeech();
    if (P.voiceOn && P.comp) P.t = P.comp.steps[stepAt(P.t)].start;
    P.dirty = true; syncButtons();
  };
  $("bCC").onclick = () => { P.ccOn = !P.ccOn; store.set("cc", P.ccOn); P.dirty = true; ui.sub = null; syncButtons(); };
  $("bSpeed").onclick = () => {
    const list = [1, 1.25, 1.5, 0.8];
    P.speed = list[(list.indexOf(P.speed) + 1) % list.length];
    try { audioEl.playbackRate = P.speed; } catch (e) {}
    syncButtons();
  };
  $("bTheme").onclick = () => { P.theme = P.theme === "note" ? "chalk" : "note"; store.set("theme", P.theme); syncButtons(); };
  $("bChap").onclick = () => $("chHead").scrollIntoView({ behavior: "smooth", block: "start" });
  $("bAnswer").onclick = () => { const a = $("pAnswer"); a.hidden = !a.hidden; $("bAnswer").textContent = a.hidden ? "정답 보기" : "정답 숨기기"; };
  $("bShare").onclick = () => { if (P.lec) shareLecture(P.lec).catch(() => toast("공유 링크를 만들지 못했어요.")); };
  $("bExport").onclick = () => { if (P.lec) exportLecture(P.lec); };
  $("bSave").onclick = () => {
    if (!P.lec || P.lec.origin !== "shared") return;
    const item = saveMine(P.lec);
    toast("내 강의 목록에 저장했어요.");
    P.lec = null; go("lec-" + item.id);
  };
  $("bShareCopy").onclick = () => { const t = $("shareUrl"); t.select(); try { navigator.clipboard.writeText(t.value).then(() => toast("복사했어요."), () => {}); } catch (e) {} try { document.execCommand("copy"); } catch (e) {} };
  $("bShareClose").onclick = () => { $("shareModal").hidden = true; };
  $("shareModal").addEventListener("click", e => { if (e.target === $("shareModal")) $("shareModal").hidden = true; });
  $("bDel").onclick = () => {
    const b = $("bDel"), L = P.lec;
    if (!L || L.origin !== "mine") return;
    if (!b.dataset.arm) { b.dataset.arm = "1"; b.textContent = "한 번 더 누르면 삭제돼요"; setTimeout(() => { if (b.dataset.arm) { b.dataset.arm = ""; b.textContent = "강의 삭제"; } }, 4000); return; }
    myLecs = myLecs.filter(x => x.id !== L.id);
    persistMine();
    leavePlayer(); P.lec = null; P.comp = null;
    toast("강의를 지웠어요.");
    go("home");
  };

  const pr = $("prog"), pop = $("pop");
  let wasPlaying = false;
  const showPop = x => {
    const t = tFromX(x), r = pr.getBoundingClientRect();
    pop.hidden = false;
    pop.style.left = clamp(x - r.left, 30, r.width - 30) + "px";
    pop.textContent = fmtTime(t) + " · " + P.comp.chapters[chapterAt(t)].title;
    return t;
  };
  pr.addEventListener("pointermove", e => { if (!P.comp) return; const t = showPop(e.clientX); if (P.drag) { P.t = t; P.dirty = true; } });
  pr.addEventListener("pointerleave", () => { if (!P.drag) pop.hidden = true; });
  pr.addEventListener("pointerdown", e => {
    if (!P.comp) return;
    try { pr.setPointerCapture(e.pointerId); } catch (er) {}
    wasPlaying = P.playing; if (P.playing) pause();
    stopSpeech();
    P.drag = true; pr.classList.add("drag");
    P.t = showPop(e.clientX); P.dirty = true;
    $("ovStart").hidden = true; $("ovEnd").hidden = true;
  });
  const end = e => {
    if (!P.drag) return;
    P.drag = false; pr.classList.remove("drag"); pop.hidden = true;
    seekTo(tFromX(e.clientX));
    if (wasPlaying || P.t > 0) play();
  };
  pr.addEventListener("pointerup", end);
  pr.addEventListener("pointercancel", end);

  document.addEventListener("keydown", e => {
    if ($("v-player").hidden || !P.comp) return;
    const tg = e.target && e.target.tagName;
    if (tg === "INPUT" || tg === "TEXTAREA" || (tg === "BUTTON" && (e.key === " " || e.key === "Enter"))) return;
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") { e.preventDefault(); toggle(); }
    else if (k === "arrowright" || k === "l") { e.preventDefault(); const si = stepAt(P.t); seekTo(si < P.comp.steps.length - 1 ? P.comp.steps[si + 1].start : P.comp.total); }
    else if (k === "arrowleft" || k === "j") { e.preventDefault(); const si = stepAt(P.t), st = P.comp.steps[si]; seekTo(P.t - st.start > 1.5 || si === 0 ? st.start : P.comp.steps[si - 1].start); }
    else if (k === "m") $("bVoice").click();
    else if (k === "c") $("bCC").click();
  });
}

/* ---------- 새 강의 만들기 ---------- */
let genImg = null, genAbort = null, genTimer = 0, previewUrl = null;
let aiInfo = null, aiChecking = null;
let devAI = store.get("ai", null);   // { provider, key, model } — 이 기기에만 저장
let keyEditing = false, pendingKeyGen = false;
const AI_NAMES = { gemini: "Google Gemini", openai: "OpenAI", anthropic: "Claude API" };
const AI_DEFAULT = { gemini: "gemini-flash-latest", openai: "gpt-5.6-terra", anthropic: "claude-sonnet-5-5" };
const AI_HELP = { gemini: "키 받는 곳: aistudio.google.com → Get API key (무료 사용량이 있어요)", openai: "키 받는 곳: platform.openai.com → API keys", anthropic: "키 받는 곳: console.anthropic.com → API Keys" };
const useServer = () => !!(aiInfo && aiInfo.ok && !aiInfo.offline);
function serverCandidates() {
  const list = [];
  const custom = String(store.get("server", "") || "").trim().replace(/\/+$/, "");
  if (custom) list.push(custom);
  if (IS_WEB) list.push("");
  if (BUILT_SERVER) list.push(BUILT_SERVER);
  return [...new Set(list)];
}
async function probeServer(base) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(base + "/api/generate", { cache: "no-store", signal: ac.signal });
    if (!/json/i.test(r.headers.get("content-type") || "")) return null;
    const j = await r.json();
    return j && typeof j === "object" && "ok" in j ? j : null;
  } catch (e) { return null; } finally { clearTimeout(tm); }
}
function checkAI() {
  if (aiChecking) return aiChecking;
  aiChecking = (async () => {
    let found = null, base = null;
    for (const b of serverCandidates()) {
      const j = await probeServer(b);
      if (j && (!found || j.ok)) { found = j; base = b; }
      if (j && j.ok) break;
    }
    aiInfo = found || { ok: false, offline: true, none: !serverCandidates().length };
    API_BASE = found ? base : null;
  })().then(() => { renderAINote(); probeTTS(); setTimeout(() => { aiChecking = null; }, 30000); });
  return aiChecking;
}
function probeTTS() {
  if (API_BASE == null) { VS.server = null; updateVoiceBar(); return; }
  fetch(API_BASE + "/api/tts", { cache: "no-store" }).then(r => r.ok ? r.json() : null)
    .then(j => { VS.server = j && j.ok ? { ok: true, provider: j.provider } : null; updateVoiceBar(); if (P.comp && !$("ovStart").hidden) $("ovSub").textContent = "강의 시작 · " + fmtTime(P.comp.total) + (useAI() ? " · AI 목소리" : ""); })
    .catch(() => {});
}
function renderAINote() {
  const n = $("aiNote"), kb = $("keyBox");
  if (!aiInfo) { n.hidden = true; kb.hidden = true; return; }
  n.textContent = "";
  const advLink = label => H("button", { class: "linkbtn", onclick: () => { keyEditing = true; renderAINote(); $("keyBox").scrollIntoView({ behavior: "smooth", block: "start" }); } }, label);
  if (keyEditing) {
    n.hidden = true; kb.hidden = false;
    $("kProv").value = (devAI && devAI.provider) || "gemini";
    $("kKey").value = (devAI && devAI.key) || "";
    $("kModel").value = (devAI && devAI.model) || "";
    $("kHelp").textContent = AI_HELP[$("kProv").value];
    syncKeyLinks();
    $("bKeyCancel").hidden = false;
    $("bKeyDel").hidden = !(devAI && devAI.key);
  } else if (useServer()) {
    n.className = "capnote ok"; n.hidden = false; kb.hidden = true;
    const needPass = aiInfo.needPasscode && !store.get("pass", "");
    n.append("선생님 서버에 연결됐어요 · " + (aiInfo.provider || "AI") + (needPass ? " · 처음 한 번만 아래에 비밀번호를 넣어 주세요" : ""));
  } else if (devAI && devAI.key) {
    n.className = "capnote ok"; n.hidden = false; kb.hidden = true;
    n.append(`이 기기에 넣은 키로 연결됐어요 · ${AI_NAMES[devAI.provider]} `, advLink("키 바꾸기"));
    if (!CAN_STORE) n.append(H("div", { class: "subnote" }, "파일로 열어서 키가 저장되지 않아요. 다음에 열면 다시 넣어야 해요."));
  } else if (puterReady()) {
    n.className = "capnote ok"; n.hidden = false; kb.hidden = true;
    n.append("AI에 연결됐어요 · Puter 계정 ", H("button", { class: "linkbtn", onclick: disconnectPuter }, "연결 끊기"));
  } else {
    n.className = "capnote connect"; n.hidden = false; kb.hidden = true;
    const connBtn = (label, primary) => { const b = H("button", { class: "btn big connbtn" + (primary ? " primary" : ""), id: "bConnect", onclick: connectPuter }, puterBusy ? "연결하는 중…" : label); b.disabled = puterBusy; return b; };
    n.append(H("b", null, "AI에 연결해 주세요"));
    if (IN_APP) {
      n.append(H("div", { class: "subnote warnline" }, IN_APP + " 안에서는 AI 로그인 창이 열리지 않아요. 크롬이나 사파리에서 열어 주세요."),
        H("button", { class: "btn primary big connbtn", onclick: openInBrowser }, IS_IOS && !/KAKAOTALK/i.test(UA) ? "주소 복사하기" : "크롬·사파리로 열기"),
        H("div", { class: "subnote" }, IS_IOS && !/KAKAOTALK/i.test(UA) ? "복사한 주소를 사파리에 붙여 넣어 열어 주세요." : "열린 브라우저에서 ‘AI 연결하기’를 눌러 주세요."));
    } else {
      n.append(H("div", { class: "subnote" }, "버튼 한 번이면 돼요. 처음 한 번만 무료 Puter 계정으로 로그인하면, 다음부터는 사진만 찍으면 강의가 만들어져요. 키는 필요 없어요."));
      if (IS_STANDALONE && IS_IOS) n.append(H("div", { class: "subnote warnline" }, "홈 화면에 추가한 앱에서는 로그인 창이 사파리로 넘어가서 연결이 안 될 수 있어요. 그러면 사파리에서 앱 주소를 열어 연결해 주세요."));
      n.append(connBtn("AI 연결하기", true));
    }
    if (puterErr) n.append(H("div", { class: "errline" }, puterErr));
    n.append(H("div", { class: "subnote" }, "직접 키가 있는 분은 ", advLink("고급 설정: 내 AI 키로 쓰기"), "를 눌러도 돼요."));
    if (!puterP && !window.puter) warmPuter();
  }
  const savedPass = store.get("pass", "");
  if (useServer() && aiInfo.needPasscode && !$("qPass").value) $("qPass").value = savedPass;
  $("passFld").hidden = !(useServer() && aiInfo.needPasscode && !savedPass);
}
function guessProvider(key) { return /^AIza/.test(key) ? "gemini" : /^sk-ant-/.test(key) ? "anthropic" : /^sk-/.test(key) ? "openai" : null; }
function syncKeyLinks() {
  const p = $("kProv").value;
  const url = { gemini: "https://aistudio.google.com/app/apikey", openai: "https://platform.openai.com/api-keys", anthropic: "https://console.anthropic.com/settings/keys" }[p];
  $("kGet").href = url;
  $("kGet").textContent = "① " + { gemini: "구글", openai: "OpenAI", anthropic: "Anthropic" }[p] + "에서 키 받기 ↗";
}
async function pasteKey() {
  let txt = "";
  try { txt = (await navigator.clipboard.readText() || "").trim(); } catch (e) {}
  if (!txt) { $("kKey").focus(); toast("키 칸을 길게 눌러서 ‘붙여넣기’를 골라 주세요."); return; }
  const g = guessProvider(txt);
  if (!g) { toast("복사한 내용이 API 키가 아닌 것 같아요. 키를 다시 복사해 주세요."); return; }
  $("kKey").value = txt; $("kProv").value = g; syncKeyLinks();
  saveKey();
}
function saveKey() {
  const key = $("kKey").value.trim(), model = $("kModel").value.trim();
  const g = guessProvider(key);
  if (g) $("kProv").value = g;
  const provider = $("kProv").value;
  if (key.length < 12) { toast("API 키를 붙여 넣어 주세요."); $("kKey").focus(); return; }
  devAI = { provider, key, model };
  store.set("ai", devAI);
  keyEditing = false; renderAINote(); VS.aiRestUntil = 0; updateVoiceBar();
  toast(CAN_STORE ? "키를 이 기기에 저장했어요." : "키를 넣었어요. (파일로 열어서 이번에만 쓸 수 있어요)");
  if (pendingKeyGen && (genImg || $("qText").value.trim())) { pendingKeyGen = false; hideErr(); generate(); }
}
function friendlyAI(status, msg, label, model) {
  if (status === 400 && /api key|API_KEY|invalid.*key/i.test(msg || "")) status = 401;
  if (status === 401 || status === 403) return `${label} API 키가 맞지 않거나 권한이 없어요. ‘키 바꾸기’에서 키를 다시 확인해 주세요.`;
  if (status === 404) return `${label}에서 모델 '${model}'을 찾지 못했어요. ‘키 바꾸기’의 모델 칸에 지금 쓸 수 있는 모델 이름을 넣어 주세요.`;
  if (status === 429) return `${label} 사용량 한도에 걸렸어요. 잠시 뒤 다시 해 보거나 무료 한도·요금제를 확인해 주세요.`;
  return `${label} 오류: ${msg || "HTTP " + status}`;
}
// 서버 없이 휴대폰에서 AI를 바로 불러요
async function callDirect(cfg, prompt, dataUrl, signal) {
  const m = dataUrl ? /^data:([^;]+);base64,(.+)$/.exec(dataUrl) : null;
  const img = m ? { mime: m[1], data: m[2] } : null;
  const model = cfg.model || AI_DEFAULT[cfg.provider], label = AI_NAMES[cfg.provider];
  let r, j, out = "";
  try {
    if (cfg.provider === "openai") {
      const content = [{ type: "input_text", text: prompt }];
      if (img) content.push({ type: "input_image", image_url: dataUrl });
      r = await fetch("https://api.openai.com/v1/responses", { method: "POST", signal, headers: { "content-type": "application/json", authorization: "Bearer " + cfg.key },
        body: JSON.stringify({ model, input: [{ role: "user", content }], text: { format: { type: "json_object" } }, max_output_tokens: 32000 }) });
    } else if (cfg.provider === "anthropic") {
      const content = [];
      if (img) content.push({ type: "image", source: { type: "base64", media_type: img.mime, data: img.data } });
      content.push({ type: "text", text: prompt });
      r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal, headers: { "content-type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model, max_tokens: 16000, messages: [{ role: "user", content }] }) });
    } else {
      const parts = [];
      if (img) parts.push({ inlineData: { mimeType: img.mime, data: img.data } });
      parts.push({ text: prompt });
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.key)}`, { method: "POST", signal, headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 32768 } }) });
    }
  } catch (e) {
    if (signal.aborted) throw e;
    throw new Error(`${label}에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.`);
  }
  try { j = await r.json(); } catch (e) { j = {}; }
  if (!r.ok) throw new Error(friendlyAI(r.status, j && j.error && (j.error.message || j.error.type), label, model));
  if (cfg.provider === "openai") {
    out = typeof j.output_text === "string" ? j.output_text : (j.output || []).filter(o => o.type === "message").flatMap(o => o.content || []).filter(c => c.type === "output_text").map(c => c.text).join("");
  } else if (cfg.provider === "anthropic") {
    out = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
  } else {
    const cand = (j.candidates || [])[0] || {};
    out = ((cand.content && cand.content.parts) || []).filter(x => typeof x.text === "string" && !x.thought).map(x => x.text).join("");
    if (!out && (cand.finishReason || (j.promptFeedback && j.promptFeedback.blockReason))) throw new Error(`${label}가 답을 주지 않았어요 (${cand.finishReason || j.promptFeedback.blockReason}). 사진을 바꿔 다시 해 보세요.`);
  }
  if (!out) throw new Error(`${label}에서 빈 답이 왔어요. 다시 한 번 눌러 주세요.`);
  return { text: out, provider: label, model };
}
const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("사진을 읽지 못했어요.")); r.readAsDataURL(b); });

function downscale(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const m = 2000, s = Math.min(1, m / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cv.toBlob(b => b ? res(b) : rej(new Error("사진을 바꾸지 못했어요.")), "image/jpeg", 0.9);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error(/heic|heif/i.test(file.type + file.name) ? "HEIC 사진은 열 수 없어요. 카메라 설정에서 '높은 호환성(JPG)'으로 바꾸거나 스크린샷으로 올려 주세요." : "이 사진은 열 수 없어요. 다른 사진으로 해 주세요.")); };
    img.src = url;
  });
}
function setImage(file, auto) {
  if (!file || (file.type && !/^image\//.test(file.type))) { showErr("사진 파일만 올릴 수 있어요."); return; }
  if (genAbort) { toast("강의를 만드는 중이에요. 끝나면 다시 올려 주세요."); return; }
  hideErr();
  $("dropInner").hidden = true; $("previewBox").hidden = false;
  $("preview").removeAttribute("src");
  downscale(file).then(blob => {
    genImg = blob;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(blob);
    $("preview").src = previewUrl;
    if (auto) generate(); else $("bGen").scrollIntoView({ behavior: "smooth", block: "center" });
  }, e => { clearImage(); showErr(e.message); });
}
function clearImage() { genImg = null; $("previewBox").hidden = true; $("preview").removeAttribute("src"); $("dropInner").hidden = false; }
function showErr(m) { const e = $("genErr"); e.textContent = m; e.hidden = false; setTimeout(() => e.scrollIntoView({ behavior: "smooth", block: "center" }), 60); }
function hideErr() { $("genErr").hidden = true; }

function parseJSON(t) {
  let s = String(t || "").replace(/```(?:json)?/gi, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("대본을 읽지 못했어요. 다시 시도해 주세요.");
  s = s.slice(a, b + 1);
  try { return JSON.parse(s); } catch (e) {}
  try { return JSON.parse(s.replace(/,\s*([}\]])/g, "$1")); } catch (e) {}
  throw new Error("대본을 읽지 못했어요. 다시 시도해 주세요.");
}
function genBusy(on) {
  $("bGen").disabled = on; $("bCancel").hidden = !on; $("genStat").hidden = !on;
  $("previewBox").querySelectorAll(".filebtn,button").forEach(b => b.classList.toggle("off", on));
  $("previewBox").querySelectorAll("input").forEach(i => { i.disabled = on; });
  if (on) setTimeout(() => $("genStat").scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  if (!on) clearInterval(genTimer);
}
async function generate() {
  if (genAbort || $("bGen").disabled) return;
  const text = $("qText").value.trim(), memo = $("qMemo").value.trim(), pass = $("qPass").value.trim();
  hideErr();
  if (!genImg && !text) { showErr("문제 사진을 올리거나 문제를 글로 적어 주세요."); return; }
  if (!aiInfo) await checkAI();
  if (!useServer() && !(devAI && devAI.key) && !puterReady()) {
    if (keyEditing) { pendingKeyGen = true; showErr("위에 AI 키를 넣고 ‘저장’을 누르면 바로 강의 만들기가 시작돼요."); return; }
    aiChecking = null; await checkAI();
    if (!useServer() && !puterReady()) {
      pendingConnectGen = true; renderAINote();
      showErr("먼저 위의 ‘AI 연결하기’를 눌러 주세요. 연결되면 이 문제로 바로 강의를 만들어요.");
      const b = $("bConnect"); if (b) setTimeout(() => { b.scrollIntoView({ behavior: "smooth", block: "center" }); b.classList.remove("pulse"); void b.offsetWidth; b.classList.add("pulse"); }, 120);
      return;
    }
  }
  const viaServer = useServer(), viaKey = !viaServer && !!(devAI && devAI.key);
  if (viaServer && aiInfo.needPasscode && !pass) { $("passFld").hidden = false; showErr("위 칸에 강의 만들기 비밀번호를 넣고 ‘강의 만들기’를 눌러 주세요."); setTimeout(() => $("qPass").focus(), 350); return; }
  genBusy(true);
  const ac = new AbortController(); genAbort = ac;
  const t0 = Date.now();
  const msgs = ["문제를 읽는 중…", "풀이 방법을 고르는 중…", "그림 좌표를 잡는 중…", "칠판 대본을 쓰는 중…", "계산을 다시 확인하는 중…", "거의 다 됐어요…"];
  genChars = 0;
  const paint = () => {
    const sec = Math.round((Date.now() - t0) / 1000);
    $("genMsg").textContent = genChars > 0 ? `칠판 대본을 쓰는 중… ${genChars.toLocaleString()}자` : msgs[Math.min(msgs.length - 1, Math.floor(sec / 15))];
    $("genSub").textContent = `${sec >= 60 ? Math.floor(sec / 60) + "분 " : ""}${sec % 60}초 지남 · 보통 1~2분 걸려요`;
  };
  paint(); genTimer = setInterval(paint, 1000);
  try {
    const payload = { text, memo, passcode: pass };
    if (genImg) payload.image = await blobToDataURL(genImg);
    let j = null;
    if (viaKey) {
      j = await callDirect(devAI, buildPrompt(text, memo, !!payload.image), payload.image, ac.signal);
    } else if (!viaServer) {
      j = await callPuter(buildPrompt(text, memo, !!genImg), genImg, ac.signal);
    } else {
    let r;
    try { r = await fetch(API_BASE + "/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: ac.signal }); }
    catch (e) { if (ac.signal.aborted) throw e; throw new Error("선생님 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요."); }
    try { j = await r.json(); } catch (e) {}
    if (!r.ok || !j || !j.ok) {
      if (j && j.code === "passcode") { store.set("pass", ""); $("passFld").hidden = false; $("qPass").value = ""; setTimeout(() => $("qPass").focus(), 300); }
      throw new Error((j && j.error) || (r.status === 504 ? "AI 답이 너무 오래 걸렸어요. 다시 한 번 눌러 주세요." : `서버 오류가 났어요 (${r.status}).`));
    }
    if (pass) store.set("pass", pass);
    }
    $("genMsg").textContent = "강의로 엮는 중…";
    const L = normalizeLecture(parseJSON(j.text));
    const item = saveMine(L, (j.provider || "") + (j.model ? " · " + j.model : ""));
    if (!CAN_STORE) toast("파일로 열어서 강의가 저장되지 않아요. 다 보면 ‘파일로 저장’을 눌러 두세요.");
    genBusy(false);
    $("qText").value = ""; $("qMemo").value = ""; clearImage();
    go("lec-" + item.id);
  } catch (e) {
    genBusy(false);
    if (ac.signal.aborted) showErr("강의 만들기를 그만뒀어요.");
    else showErr((e && e.message) || "강의를 만들지 못했어요. 다시 시도해 주세요.");
  } finally { genAbort = null; }
}
function wireNew() {
  let camTimer = 0, camCancel = null;
  const showCamHint = () => {
    if ($("v-new").hidden) go("new");
    const n = $("camHint"); n.hidden = false;
    setTimeout(() => n.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    document.querySelectorAll(".filebtn[data-pick]").forEach(b => { b.classList.remove("pulse"); void b.offsetWidth; b.classList.add("pulse"); });
  };
  document.querySelectorAll('input[type=file][data-kind]').forEach(inp => {
    inp.addEventListener("change", () => {
      if (camCancel) camCancel();
      const f = inp.files && inp.files[0];
      if (f) { $("camHint").hidden = true; if ($("v-new").hidden) go("new"); setImage(f, inp.dataset.kind === "cam"); }
      inp.value = "";
    });
    if (inp.dataset.kind === "cam") inp.addEventListener("click", () => {
      if (camCancel) camCancel();
      const cancel = () => { clearTimeout(camTimer); window.removeEventListener("blur", cancel); document.removeEventListener("visibilitychange", cancel); camCancel = null; };
      camCancel = cancel;
      window.addEventListener("blur", cancel); document.addEventListener("visibilitychange", cancel);
      camTimer = setTimeout(() => { cancel(); showCamHint(); }, 1600);
    });
  });
  const d = $("drop");
  d.addEventListener("dragover", e => { e.preventDefault(); d.classList.add("over"); });
  d.addEventListener("dragleave", () => d.classList.remove("over"));
  d.addEventListener("drop", e => { e.preventDefault(); d.classList.remove("over"); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) setImage(f); });
  window.addEventListener("paste", e => {
    if ($("v-new").hidden) return;
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (const it of items) if (it.kind === "file" && /^image\//.test(it.type)) { setImage(it.getAsFile()); e.preventDefault(); return; }
  });
  $("bClearImg").onclick = e => { e.preventDefault(); if (!genAbort) clearImage(); };
  $("bGen").onclick = generate;
  $("qPass").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); generate(); } });
  $("bKeySave").onclick = saveKey;
  $("bKeyCancel").onclick = () => { keyEditing = false; pendingKeyGen = false; renderAINote(); };
  $("bKeyDel").onclick = () => { devAI = null; store.set("ai", null); keyEditing = false; renderAINote(); toast("이 기기에 넣은 키를 지웠어요."); };
  $("kProv").onchange = () => { $("kHelp").textContent = AI_HELP[$("kProv").value]; $("kModel").placeholder = "비워 두면 " + AI_DEFAULT[$("kProv").value]; syncKeyLinks(); };
  $("bKeyPaste").onclick = pasteKey;
  $("kKey").addEventListener("paste", () => setTimeout(() => { const v = $("kKey").value.trim(), g = guessProvider(v); if (g && v.length >= 30) { $("kProv").value = g; syncKeyLinks(); saveKey(); } }, 50));
  $("bCancel").onclick = () => { if (genAbort) genAbort.abort(); };
}

/* ---------- 공유 강의 묶음 + 앱 설치 ---------- */
function loadLibrary() {
  fetch("/lectures/library.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : []).then(arr => {
    if (!Array.isArray(arr)) return;
    libLecs = arr.map((x, i) => { try { return Object.assign(normalizeLecture(x), { id: "lib-" + (String(x.id || i).replace(/[^a-zA-Z0-9-]/g, "") || i), origin: "lib" }); } catch (e) { return null; } }).filter(Boolean);
    renderHome();
    if (/^#lec-lib-/.test(location.hash) && $("v-player").hidden) route();
  }).catch(() => {});
}
function wireExtras() {
  $("importIn").addEventListener("change", e => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) importFiles(fs); });
  $("bInstall").onclick = async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch (e) {} installEvt = null; renderInstall(); };
  $("bInstallX").onclick = () => { store.set("installX", true); renderInstall(); };
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("/sw.js").catch(() => {});
}

/* ---------- 시작 ---------- */
try { if (matchMedia("(pointer: coarse)").matches || "ontouchstart" in window) document.body.classList.add("touch"); } catch (e) {}
drawRules();
wireControls();
wireNew();
initWebVoice();
wireExtras();
wireVoice();
syncButtons();
route();
loadLibrary();
requestAnimationFrame(loop);
fontP.then(() => {
  renderHome();
  if (P.lec && !P.compFonts && !P.playing && P.t === 0) { const L = P.lec; P.lec = null; openLecture(L); }
});
})();
