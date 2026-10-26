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

  // 1. limpiar la alerta anterior y esconder todo mientras carga la nueva
  alert.classList.remove("show");
  img.style.display = vid.style.display = "none";
  alert.classList.toggle("has-media", !!media);
  const nameEl = document.getElementById("clay-name");
  const amountEl = document.getElementById("clay-amount");
  nameEl.innerHTML = amountEl.innerHTML = "";
  closeDialog();

  // 2. esperar a que la imagen o el video carguen: sin eso la alerta mide 0 de alto
  //    y el nombre cae en cualquier lado
  if (media && isVideo) {
    vid.src = media;
    await new Promise(r => { vid.onloadeddata = r; vid.onerror = r; setTimeout(r, 3000); });
    vid.style.display = "block"; vid.currentTime = 0; vid.play().catch(() => {});
  } else if (media) {
    img.src = media;
    await img.decode().catch(() => {});
    img.style.display = "block";
  }

  // 3. posiciones propias de este tipo de alerta (en % de la imagen)
  alert.style.setProperty("--nx", (+F[type + "NameX"]) + "%");
  alert.style.setProperty("--ny", (+F[type + "NameY"]) + "%");
  alert.style.setProperty("--nw", (+F[type + "NameW"]) + "%");
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));   // que se apliquen

  // 4. nombre y monto con letras de plastilina
  const box = document.getElementById("label-box");
  alert.classList.add("show");
  const common = { folder: base + "glyphs/", animate: true, jitter: +F.jitter };
  ClayText.render(nameEl, String(ev.name || ev.displayName || "").trim(),
    Object.assign({}, common, { size: +F.nameSize, maxWidth: box.clientWidth, color: F.nameColor }));

  const showAmount = F[type + "Amount"] === "yes" && ev.amount;
  if (showAmount) {
    let n = ev.amount;
    if (type === "tip") n = (+n).toFixed(2).replace(/\.00$/, "");
    const suffix = +n === 1 && F[type + "SuffixOne"] !== undefined ? F[type + "SuffixOne"] : F[type + "Suffix"];
    const text = (F[type + "Prefix"] || "") + n + (suffix || "");
    ClayText.render(amountEl, text, Object.assign({}, common, { size: +F.amountSize, color: F.amountColor }));
  }

  const sound = F[type + "Sound"];
  if (sound) { snd.src = sound; snd.volume = (+F.volume || 50) / 100; snd.currentTime = 0; snd.play().catch(() => {}); }

  // 5. mensaje en la caja de diálogo, letra por letra (después de que cae el nombre)
  const msg = F.showMessage === "yes" && F[type + "Dialog"] !== "no" ? (ev.message || "") : "";
  let typed = 0;
  if (msg.trim()) {
    const nameLen = [...String(ev.name || "")].length;
    await wait(400 + nameLen * 70);
    typed = await typeMessage(msg);
  }

  // la alerta dura lo normal + lo que tome escribir y leer el mensaje
  const extra = typed ? typed * 1000 / (+F.typeSpeed || 35) + Math.min(8000, typed * 45) : 0;
  await wait((+F.duration || 6) * 1000 + extra);
  closeDialog();
  alert.classList.remove("show");
  await wait(500);
  vid.pause();
}

// ---- caja de diálogo con texto que se va escribiendo ----
function closeDialog() {
  document.getElementById("dialog").classList.remove("open");
  const inner = document.getElementById("dialog-inner");
  inner.style.height = "0px";
  document.getElementById("dialog-text").innerHTML = "";
}

async function typeMessage(html) {
  const dialog = document.getElementById("dialog");
  const inner = document.getElementById("dialog-inner");
  const out = document.getElementById("dialog-text");

  // el mensaje trae texto y emotes (<img>); se separa en piezas para escribirlas una a una
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const pieces = [];
  (function walk(node) {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) for (const ch of n.textContent) pieces.push(ch);
      else if (n.tagName === "IMG") pieces.push(n.cloneNode());
      else walk(n);
    }
  })(tmp);
  const max = +F.maxChars || 300;
  if (pieces.length > max) { pieces.length = max; pieces.push("…"); }

  out.innerHTML = "";
  const pad = () => {   // alto = texto + relleno + borde
    const cs = getComputedStyle(inner);
    return out.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
         + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  };
  out.textContent = "\u00a0";                     // una línea vacía para abrir la caja
  inner.style.height = pad() + "px";
  dialog.classList.add("open");
  await wait(220);
  out.textContent = "";

  const delay = 1000 / (+F.typeSpeed || 35);
  let lastH = 0;
  for (const p of pieces) {
    if (typeof p === "string") out.append(p); else out.append(p);
    const h = pad();
    if (h !== lastH) { inner.style.height = h + "px"; lastH = h; }   // saltó de línea: la caja crece
    const pause = typeof p === "string" && /[.!?,]/.test(p) ? delay * 4 : delay;
    await wait(pause);
  }
  return pieces.length;
}
