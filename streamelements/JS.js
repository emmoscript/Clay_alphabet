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
  document.getElementById("stage").className = "center";      // siempre centrada en el widget
  console.log("clay-alerts v25");
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

// ---- bits de Twitch: "Cheer100" -> gema oficial + número del color de su nivel ----
const CHEER_TIERS = [            // [mínimo, color]  (colores oficiales de Twitch)
  [100000, "#f3a71a"], [10000, "#f43021"], [5000, "#0099fe"],
  [1000, "#1db2a5"], [100, "#9c3ee8"], [1, "#979797"],
];
const CHEER_PREFIXES = ["Cheer", "DoodleCheer", "BibleThump", "cheerwhal", "Corgo", "Scoops", "uni", "ShowLove",
  "Party", "SeemsGood", "Pride", "Kappa", "FrankerZ", "HeyGuys", "DansGame", "EleGiggle", "TriHard", "Kreygasm",
  "4Head", "SwiftRage", "NotLikeThis", "FailFish", "VoHiYo", "PJSalt", "MrDestructoid", "bday", "RIPCheer", "Shamrock"];
const tierOf = n => CHEER_TIERS.find(t => n >= t[0]) || CHEER_TIERS[CHEER_TIERS.length - 1];

// gema dibujada, por si la imagen oficial no carga
function gemSVG(color) {
  return "data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><path d="M14 2 26 14 14 26 2 14Z" fill="${color}"/>` +
    `<path d="M14 2 26 14H2Z" fill="#fff" opacity=".35"/></svg>`);
}
function cheerImg(prefix, n) {
  const [tier, color] = tierOf(n);
  const img = document.createElement("img");
  img.className = "cheermote";
  img.dataset.color = color;
  // 1) tu imagen del panel, 2) la de tu carpeta en GitHub (cheer/100.gif…), 3) la dibujada
  const base = (F.baseUrl || "").replace(/\/?$/, "/");
  const mine = F["cheerGem" + tier];
  img.src = mine || `${base}cheer/${tier}.gif`;
  img.onerror = () => { img.onerror = null; img.src = gemSVG(color); };
  return img;
}
// si una gema oficial no carga (aunque el <img> se haya copiado), se cambia por la dibujada
document.addEventListener("error", (e) => {
  const t = e.target;
  if (t.classList && t.classList.contains("cheermote") && !t.dataset.fallback) {
    t.dataset.fallback = "1";
    t.src = gemSVG(t.dataset.color || "#979797");
  }
}, true);

// cambia los "Cheer100" del mensaje por gema + número, en el mismo orden en que aparecen
function withCheermotes(html) {
  const re = new RegExp(`\\b(${CHEER_PREFIXES.join("|")})(\\d+)\\b`, "gi");
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
  const texts = [];
  while (walker.nextNode()) texts.push(walker.currentNode);
  for (const t of texts) {
    if (!re.test(t.textContent)) continue;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = re.exec(t.textContent))) {
      frag.append(t.textContent.slice(last, m.index));
      const n = +m[2];
      const span = document.createElement("span");
      span.className = "cheer";
      span.append(cheerImg(m[1], n));
      const b = document.createElement("b");
      b.textContent = n.toLocaleString("en-US");
      b.style.color = tierOf(n)[1];
      span.append(b);
      frag.append(span);
      last = re.lastIndex;
    }
    frag.append(t.textContent.slice(last));
    t.replaceWith(frag);
  }
  return tmp.innerHTML;
}

// ---- frases de agradecimiento en español, inglés o spanglish ----
function escapeHTML(s) { return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

function thanksLine(type, ev) {
  let lang = F.language || "es";
  if (lang === "off" || F[type + "ThanksOn"] === "no") return "";
  if (lang === "mix") lang = pick(["es", "en", "spanglish"]);   // cada alerta en un idioma distinto
  const gift = type === "sub" && (ev.gifted || ev.bulkGifted) && ev.sender;
  const key = gift ? "subGiftThanks_" + lang : type + "Thanks_" + lang;
  const options = String(F[key] || "").split("|").map(s => s.trim()).filter(Boolean);
  if (!options.length) return "";
  const n = +ev.amount || 0;
  const num = type === "tip" ? (+n).toFixed(2).replace(/\.00$/, "") : n.toLocaleString("en-US");
  const one = n === 1;
  const words = {
    name: ev.name || "", sender: ev.sender || "", amount: num, monto: (F.tipPrefix || "$") + num,
    meses: num + (one ? " mes" : " meses"), months: num + (one ? " month" : " months"),
    bits: num + (one ? " bit" : " bits"),
    personas: num + (one ? " persona" : " personas"), people: num + (one ? " person" : " people"),
  };
  return pick(options).replace(/\{(\w+)\}/g, (m, k) => (k in words ? words[k] : m));
}

// placas que vienen en tu carpeta (alerts/): tamaño en px y cuánto miden las curvas de las esquinas
const PLATES = {
  s: { file: "plate_s.png", w: 1000, h: 308, sx: 191, sy: 123, rim: 62 },
  m: { file: "plate_m.png", w: 1000, h: 347, sx: 183, sy: 129, rim: 62 },
  l: { file: "plate_l.png", w: 1000, h: 558, sx: 187, sy: 145, rim: 62 },
};

// alto que ocupará el texto (frase + mensaje) dentro de la placa, medido antes de mostrar
function textHeight(width, thanks, msgHTML) {
  const probe = document.createElement("div");
  Object.assign(probe.style, { position: "absolute", visibility: "hidden", left: "-9999px", top: 0,
    width: width + "px", font: `600 ${+F.messageSize}px/1.35 "Fredoka", sans-serif`, overflowWrap: "anywhere",
    textAlign: F.messageAlign || "center" });
  probe.innerHTML = (thanks ? `<div style="font-size:${+F.thanksSize}px">${escapeHTML(thanks)}</div>` : "") +
                    (msgHTML ? `<div style="margin-top:4px">${msgHTML}</div>` : "");
  document.body.appendChild(probe);
  const h = probe.offsetHeight;
  probe.remove();
  return (thanks || msgHTML) ? h + (+F.dialogGap || 0) : 0;
}

// etiqueta centrada justo sobre la curva de la esquina (o en el centro de un lado)
let CURVE = { rx: 40, ry: 40, rim: 8 };   // curva de la placa actual, en px de pantalla
function placeBadge(type) {
  const plate = document.getElementById("plate"), badge = document.getElementById("badge");
  const bw = parseFloat(getComputedStyle(plate).borderTopWidth) || 0;   // la posición se mide desde dentro del borde
  const W = plate.offsetWidth, H = plate.offsetHeight;
  const { rx, ry, rim } = CURVE;
  // punto a 45° sobre la curva, en el centro del rollo de plastilina
  const cx = rx * (1 - Math.SQRT1_2) + rim / 2 * Math.SQRT1_2;
  const cy = ry * (1 - Math.SQRT1_2) + rim / 2 * Math.SQRT1_2;
  const spots = {
    "bottom-right": [W - cx, H - cy], "bottom-left": [cx, H - cy],
    "top-right": [W - cx, cy], "top-left": [cx, cy], "top-center": [W / 2, rim / 2],
  };
  const [x, y] = spots[F.badgeSpot] || spots["bottom-right"];
  // ajuste general + ajuste propio de cada etiqueta (las anchas se corren un poco)
  badge.style.left = (x - bw) + "px";
  badge.style.top = (y - bw) + "px";
  const scale = +F[type + "BadgeScale"] || 1;                // tamaño propio de cada etiqueta
  badge.style.height = (+F.badgeHeight || 100) * scale + "px";
  const ownRot = F[type + "BadgeRot"];                     // giro propio de esta etiqueta (vacío = el general)
  badge.style.setProperty("--rot", (ownRot !== undefined && ownRot !== "" ? +ownRot : (+F.badgeRotate || 0)) + "deg");
  badge.style.display = "block";

  // cuánto sobresale la etiqueta de la placa, en % de su propio tamaño (ya girada):
  // así queda igual en las 3 placas y tapa la esquina redonda
  if (F.badgeSpot !== "top-center") {
    const spot = F.badgeSpot || "bottom-right";
    const p = plate.getBoundingClientRect(), b = badge.getBoundingClientRect();
    const wantX = b.width * (+F.badgeOutX || 0) / 100, wantY = b.height * (+F.badgeOutY || 0) / 100;
    const outX = spot.endsWith("right") ? b.right - p.right : p.left - b.left;
    const outY = spot.startsWith("bottom") ? b.bottom - p.bottom : p.top - b.top;
    const z = +document.getElementById("alert").style.zoom || 1;     // las medidas vienen con el zoom aplicado
    const sx = spot.endsWith("right") ? 1 : -1, sy = spot.startsWith("bottom") ? 1 : -1;
    badge.style.left = (parseFloat(badge.style.left) + sx * (wantX - outX) / z) + "px";
    badge.style.top = (parseFloat(badge.style.top) + sy * (wantY - outY) / z) + "px";
  }
  // + ajuste a mano de cada etiqueta
  badge.style.left = (parseFloat(badge.style.left) + (+F.badgeDX || 0) + (+F[type + "BadgeDX"] || 0)) + "px";
  badge.style.top = (parseFloat(badge.style.top) + (+F.badgeDY || 0) + (+F[type + "BadgeDY"] || 0)) + "px";

  // fijar la etiqueta a la esquina (no a la posición de ahora): si la placa crece, la etiqueta la sigue
  const spotNow = F.badgeSpot || "bottom-right";
  const innerW = W - 2 * bw, innerH = H - 2 * bw;
  const L = parseFloat(badge.style.left), T = parseFloat(badge.style.top);
  badge.style.left = spotNow.endsWith("right") ? `calc(100% + ${L - innerW}px)` : spotNow === "top-center" ? `calc(50% + ${L - innerW / 2}px)` : L + "px";
  badge.style.top = spotNow.startsWith("bottom") ? `calc(100% + ${T - innerH}px)` : T + "px";
  void badge.offsetWidth;
  badge.classList.add("stamp");
}

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
  const plate = document.getElementById("plate");
  const charBox = document.getElementById("char");
  const img = document.getElementById("char-img");
  const vid = document.getElementById("char-vid");
  const badge = document.getElementById("badge");
  const snd = document.getElementById("sound");
  // personaje: el del panel, o el de tu carpeta characters/ (follow, sub, giftsub, tip, cheer, raid)
  const isGift = type === "sub" && (ev.gifted || ev.bulkGifted);
  const charKey = isGift ? "giftsub" : type;
  const media = (isGift ? F.subGiftMedia : F[type + "Media"]) ||
                (F.showCharacters === "no" ? "" : `${base}characters/${charKey}.webm`);
  const isVideo = /\.(webm|mp4|mov)(\?|$)/i.test(media);

  // 1. limpiar la alerta anterior y esconder todo mientras carga la nueva
  alert.classList.remove("show");
  img.style.display = vid.style.display = badge.style.display = "none";
  const nameEl = document.getElementById("clay-name");
  const amountEl = document.getElementById("clay-amount");
  charBox.classList.toggle("none", !media);
  const charH = (+F.charHeight || 260) * (+F[(isGift ? "subGift" : type) + "CharScale"] || 1);
  charBox.style.setProperty("--ch", charH + "px");
  const ck = (isGift ? "subGift" : type);
  // cuánto se mete sobre la placa: el general + el propio de este personaje
  charBox.style.setProperty("--co", ((+F.charOverlap || 0) + (+F[ck + "CharShift"] || 0)) + "px");
  // cabezas que flotan (corazón, payaso) van centradas en vertical; los que están de pie, apoyados abajo
  charBox.style.alignSelf = F[ck + "CharAlign"] === "center" ? "center" : "flex-end";
  charBox.style.setProperty("--cl", (+F.charLift || 0) + "px");
  const thanksEl = document.getElementById("clay-thanks");
  nameEl.innerHTML = amountEl.innerHTML = thanksEl.innerHTML = "";
  closeDialog();

  // textos de esta alerta (se calculan antes para escoger la placa)
  let msg = F.showMessage === "yes" && F[type + "Dialog"] !== "no" ? (ev.message || "") : "";
  if (type === "cheer" && msg) msg = withCheermotes(msg);
  const thanks = thanksLine(type, ev);

  // 3 placas: se usa la más pequeña donde cabe todo; si ni la grande alcanza, la grande se estira
  const W = plate.offsetWidth || (+F.alertWidth || 760);
  const k = W / 1000;
  const padY = +F.platePadY || 0, padX = +F.platePadX || 0;
  const clayThanks = !!thanks && F.thanksClay !== "no";       // frase en letras de plastilina
  const gap = +F.amountGap || 0;
  const labelH = +F.nameSize * 1.35          // cada línea de plastilina: alto de letra + espacio para g, p, y
    + (F[type + "Amount"] === "yes" && ev.amount ? +F.amountSize * 1.35 + gap : 0)
    + (clayThanks ? +F.thanksClaySize * 1.35 + gap : 0);
  const textW = W - 2 * (PLATES.s.rim * k + padX);
  // espacio extra solo si la etiqueta va arriba (en la esquina de abajo no tapa nada)
  const spot = F.badgeSpot || "bottom-right";
  const badgeRoom = F.showBadges === "no" || !spot.startsWith("top") ? 0 : (+F.badgeHeight || 100) * 0.38;
  plate.style.paddingTop = (padY + badgeRoom) + "px";
  const cornerRoom = 0;   // el mensaje ya es más angosto que la placa: la etiqueta de la esquina no lo tapa
  plate.style.paddingBottom = (padY + cornerRoom) + "px";
  const textH = textHeight(textW * (+F.messageWidth || 86) / 100, clayThanks ? "" : thanks, msg.trim() ? msg : "");
  const needH = labelH + textH + 2 * (padY + PLATES.s.rim * k) + badgeRoom + cornerRoom;
  let chosen = "l";
  // cada placa puede estirarse un poco (hasta +30%) antes de pasar a la siguiente
  for (const key of ["s", "m", "l"]) if (PLATES[key].h * k * 1.3 >= needH) { chosen = key; break; }
  const P = PLATES[chosen];
  const own = F[type + "Plate"] || F["plate" + chosen.toUpperCase()];   // imagen subida en el panel (opcional)
  const plateImg = own || (F.useDrawnPlate === "yes" ? "" : `${base}alerts/${P.file}`);
  if (plateImg) {
    plate.classList.remove("drawn");
    const sy = P.sy, sx = P.sx;
    plate.style.borderImage = `url("${plateImg}") ${sy} ${sx} fill / ${sy * k}px ${sx * k}px stretch`;
    plate.style.borderWidth = `${P.rim * k}px`;
    plate.style.minHeight = `${P.h * k}px`;
    // misma esquina para las 3 placas: la etiqueta queda en el mismo sitio sea cual sea la placa
    CURVE = { rx: 187 * k, ry: 132 * k, rim: P.rim * k };
  } else {
    plate.classList.add("drawn");
    CURVE = { rx: 40, ry: 40, rim: 8 };
    plate.style.borderImage = "";
    plate.style.borderWidth = "";
    plate.style.minHeight = "";
  }

  // el espacio del mensaje se reserva desde el principio: el nombre no se mueve mientras se escribe
  // (se mide el texto real, dentro de la placa, invisible por un instante)
  {
    const dt = document.getElementById("dialog-text");
    const html = (thanks && !clayThanks ? `<div class="thanks">${escapeHTML(thanks)}</div>` : "") +
                 (msg.trim() ? `<div class="user-msg">${msg}</div>` : "");
    dt.style.visibility = "hidden";
    dt.innerHTML = html;
    const realT = html ? dt.offsetHeight : 0;
    dt.innerHTML = "";
    dt.style.visibility = "";
    document.getElementById("dialog").style.minHeight = realT ? realT + "px" : "";
  }

  // 2. esperar a que carguen personaje y etiqueta antes de mostrar nada
  const loads = [];
  if (media && isVideo) {
    vid.src = media;
    loads.push(new Promise(r => { vid.onloadeddata = r; vid.onerror = r; setTimeout(r, 3000); }));
  } else if (media) {
    img.src = media;
    loads.push(img.decode().catch(() => {}));
  }
  const gifted = type === "sub" && (ev.gifted || ev.bulkGifted);
  const badgeKey = gifted ? "giftsub" : { follow: "follow", sub: "sub", tip: "tip", cheer: "cheer", raid: "raid" }[type];
  const badgeSrc = (gifted ? F.subGiftBadge : F[type + "Badge"]) || (F.showBadges === "no" ? "" : `${base}alerts/badge_${badgeKey}.png`);
  if (badgeSrc) { badge.src = badgeSrc; loads.push(badge.decode().catch(() => {})); }
  if (plateImg) { const p = new Image(); p.src = plateImg; loads.push(p.decode().catch(() => {})); }
  await Promise.all(loads);

  // que la alerta completa (con la etiqueta que sobresale) quepa siempre dentro del widget
  const plateH = Math.max(plateImg ? P.h * k : 0, needH);
  const bh = +F.badgeHeight || 100;
  const bwid = badgeSrc && badge.naturalWidth ? bh * badge.naturalWidth / badge.naturalHeight : bh;
  const over = badgeSrc ? bh * 0.6 : 0;                 // lo que sobresale por abajo
  const overX = badgeSrc ? bwid * 0.55 : 0;             // lo que sobresale por el lado
  const charW = media && isVideo && vid.videoWidth ? charH * vid.videoWidth / vid.videoHeight
              : media && img.naturalWidth ? charH * img.naturalWidth / img.naturalHeight : 0;
  const groupW = (+F.alertWidth || 760) + (charW ? charW - (+F.charOverlap || 0) : 0);
  const groupH = Math.max(plateH, charW ? charH + (+F.charLift || 0) : 0);
  const fit = Math.min(1, (window.innerHeight - 24) / (groupH + over), (window.innerWidth - 24) / (groupW + 2 * overX));
  alert.style.zoom = fit;
  // la etiqueta sobresale por abajo: se deja ese espacio libre en el borde del widget
  const stage = document.getElementById("stage");
  // centrar el conjunto placa + etiqueta (no solo la placa): se compensa lo que sobresale la etiqueta
  const corner = F.badgeSpot || "bottom-right";
  const padB = corner.startsWith("bottom") ? over * 0.75 * fit : 0;
  const padT = corner.startsWith("top") ? over * 0.75 * fit : 0;
  const padR = corner.endsWith("right") ? overX * fit : 0;
  const padL = corner.endsWith("left") ? overX * fit : 0;
  Object.assign(stage.style, { paddingTop: 12 + padT + "px", paddingBottom: 12 + padB + "px",
                               paddingLeft: 12 + padL + "px", paddingRight: 12 + padR + "px" });

  if (media && isVideo) { vid.style.display = "block"; vid.currentTime = 0; vid.play().catch(() => {}); }
  else if (media) img.style.display = "block";
  badge.classList.remove("stamp");
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  // 4. nombre y monto con letras de plastilina
  const box = document.getElementById("label-box");
  alert.classList.add("show");
  const common = { folder: base + "glyphs/", animate: true, jitter: +F.jitter };
  ClayText.render(nameEl, String(ev.name || ev.displayName || "").trim(),
    Object.assign({}, common, { size: +F.nameSize, maxWidth: box.clientWidth, color: F.nameColor }));

  if (badgeSrc) { await wait(250); placeBadge(type); }

  const showAmount = F[type + "Amount"] === "yes" && ev.amount;
  if (showAmount) {
    let n = ev.amount;
    if (type === "tip") n = (+n).toFixed(2).replace(/\.00$/, "");
    const suffix = +n === 1 && F[type + "SuffixOne"] !== undefined ? F[type + "SuffixOne"] : F[type + "Suffix"];
    const text = (F[type + "Prefix"] || "") + n + (suffix || "");
    ClayText.render(amountEl, text, Object.assign({}, common, { size: +F.amountSize, color: F.amountColor }));
    if (type === "cheer" && F.cheerGem !== "no") {      // gema del nivel delante del número
      const gem = cheerImg("Cheer", +ev.amount);
      gem.style.cssText = `height:${+F.amountSize * 1.1}px;width:auto;margin-right:${+F.amountSize * 0.12}px;align-self:center;flex:none`;
      amountEl.prepend(gem);
    }
  }

  // frase de agradecimiento en plastilina (sin ¡ ¿, que no existen en el alfabeto)
  if (clayThanks) {
    await wait(250);
    ClayText.render(thanksEl, thanks.replace(/[¡¿]/g, "").trim(),
      Object.assign({}, common, { size: +F.thanksClaySize, maxWidth: box.clientWidth, color: F.thanksClayColor }));
  }

  // si al final la placa quedó más alta de lo calculado, se reajusta para que nada se corte
  await new Promise(r => requestAnimationFrame(r));
  {
    const realH = plate.offsetHeight + over;
    const z = +alert.style.zoom || 1;
    const room = window.innerHeight - 24 - parseFloat(stage.style.paddingBottom || 0) + 12;
    if (realH * z > room) alert.style.zoom = Math.max(0.4, room / realH);
  }

  const sound = F[type + "Sound"];
  if (sound) { snd.src = sound; snd.volume = (+F.volume || 50) / 100; snd.currentTime = 0; snd.play().catch(() => {}); }

  // 5. frase de agradecimiento (español / inglés / spanglish) + mensaje del usuario, letra por letra
  const segments = [];
  if (thanks && !clayThanks) segments.push({ cls: "thanks", html: escapeHTML(thanks) });
  if (msg.trim()) segments.push({ cls: "user-msg", html: msg });

  let typed = 0;
  if (segments.length) {
    const nameLen = [...String(ev.name || "")].length;
    await wait(400 + nameLen * 70);
    typed = await typeMessage(segments);
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

function toPieces(html) {
  // el texto trae letras, emotes (<img>) y bits (<span class="cheer">); se separa en piezas
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const pieces = [];
  (function walk(node) {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) for (const ch of n.textContent) pieces.push(ch);
      else if (n.tagName === "IMG") pieces.push(n.cloneNode());
      else if (n.classList && n.classList.contains("cheer")) pieces.push(n);
      else walk(n);
    }
  })(tmp);
  return pieces;
}

async function typeMessage(segments) {
  const dialog = document.getElementById("dialog");
  const inner = document.getElementById("dialog-inner");
  const out = document.getElementById("dialog-text");
  const pad = () => {
    const cs = getComputedStyle(inner);
    return out.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
         + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  };
  out.innerHTML = "";
  out.textContent = "\u00a0";                     // una línea vacía para abrir
  inner.style.height = pad() + "px";
  dialog.classList.add("open");
  await wait(220);
  out.textContent = "";

  const delay = 1000 / (+F.typeSpeed || 35);
  let lastH = 0, total = 0;
  const max = +F.maxChars || 300;
  for (const [si, seg] of segments.entries()) {
    const line = document.createElement("div");
    line.className = seg.cls;
    out.append(line);
    const pieces = toPieces(seg.html);
    if (seg.cls === "user-msg" && pieces.length > max) { pieces.length = max; pieces.push("…"); }
    if (si > 0) await wait(350);                    // respiro entre el gracias y el mensaje
    for (const p of pieces) {
      line.append(p);
      if (typeof p !== "string") {                   // gemas que fallaron antes de entrar a la página
        const imgs = p.tagName === "IMG" ? [p] : [...p.querySelectorAll("img")];
        for (const im of imgs.filter(i => i.classList.contains("cheermote"))) {
          const fix = () => { if (!im.dataset.fallback) { im.dataset.fallback = "1"; im.src = gemSVG(im.dataset.color || "#979797"); } };
          im.onerror = fix;
          if (im.complete && !im.naturalWidth) fix();
        }
      }
      const h = pad();
      if (h !== lastH) { inner.style.height = h + "px"; lastH = h; }   // bajó de línea: crece
      await wait(typeof p === "string" && /[.!?,]/.test(p) ? delay * 4 : delay);
    }
    total += pieces.length;
  }
  return total;
}
