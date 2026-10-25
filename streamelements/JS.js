// Alertas con letras de plastilina para StreamElements (Custom Widget).
// Todo se configura en el panel de la izquierda (campos); aquí no hay que tocar nada.
let F = {};
const queue = [];
let busy = false;

const EVENTS = {
  "follower-latest":   "follow",
  "subscriber-latest": "sub",
  "tip-latest":        "tip",
  "cheer-latest":      "cheer",
  "raid-latest":       "raid",
};

window.addEventListener("onWidgetLoad", (obj) => {
  F = obj.detail.fieldData;
  const base = (F.baseUrl || "").replace(/\/?$/, "/");
  const s = document.createElement("script");
  s.src = base + "clay_text.js";
  s.onload = () => ClayText.load(base + "glyphs/");
  document.head.appendChild(s);
});

window.addEventListener("onEventReceived", (obj) => {
  const type = EVENTS[obj.detail.listener];
  if (!type) return;
  const ev = obj.detail.event || {};
  if (F[type + "On"] === "no") return;
  if (ev.isCommunityGift) return;                       // los regalos en grupo llegan una sola vez
  if ((type === "tip" || type === "cheer" || type === "raid") && (+ev.amount || 0) < (+F[type + "Min"] || 0)) return;
  queue.push({ type, ev });
  next();
});

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function next() {
  if (busy || !queue.length) return;
  busy = true;
  const { type, ev } = queue.shift();
  try { await play(type, ev); } catch (e) { console.error(e); }
  busy = false;
  next();
}

async function play(type, ev) {
  const base = (F.baseUrl || "").replace(/\/?$/, "/");
  for (let i = 0; i < 50 && !(window.ClayText && window.CLAY_GLYPHS); i++) await wait(100);

  const alert = document.getElementById("alert");
  const img = document.getElementById("media-img");
  const vid = document.getElementById("media-vid");
  const snd = document.getElementById("sound");
  const media = F[type + "Media"] || "";
  const isVideo = /\.(webm|mp4|mov)(\?|$)/i.test(media);

  img.style.display = vid.style.display = "none";
  if (media && isVideo) { vid.src = media; vid.style.display = "block"; vid.currentTime = 0; vid.play().catch(() => {}); }
  else if (media)       { img.src = media; img.style.display = "block"; }

  // nombre y monto con letras de plastilina
  const nameEl = document.getElementById("clay-name");
  const amountEl = document.getElementById("clay-amount");
  const box = document.getElementById("name-box");
  nameEl.innerHTML = amountEl.innerHTML = "";
  alert.classList.add("show");
  await wait(50);
  const common = { folder: base + "glyphs/", animate: true, jitter: +F.jitter };
  ClayText.render(nameEl, String(ev.name || ev.displayName || "").trim(),
    Object.assign({}, common, { size: +F.nameSize, maxWidth: box.clientWidth, color: F.nameColor }));

  const showAmount = F[type + "Amount"] === "yes" && ev.amount;
  if (showAmount) {
    let n = ev.amount;
    if (type === "tip") n = (+n).toFixed(2).replace(/\.00$/, "");
    const text = (F[type + "Prefix"] || "") + n + (F[type + "Suffix"] || "");
    ClayText.render(amountEl, text, Object.assign({}, common, { size: +F.amountSize, color: F.amountColor }));
  }

  // mensaje del usuario (donaciones, bits, subs) en texto normal
  document.getElementById("message").innerHTML = F.showMessage === "yes" ? (ev.message || "") : "";

  const sound = F[type + "Sound"];
  if (sound) { snd.src = sound; snd.volume = (+F.volume || 50) / 100; snd.currentTime = 0; snd.play().catch(() => {}); }

  await wait((+F.duration || 6) * 1000);
  alert.classList.remove("show");
  await wait(500);
  vid.pause();
}
