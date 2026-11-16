// clay-chat v2 — chat de plastilina (Twitch nativo en StreamElements; más plataformas después)
let F = {};
const chat = document.getElementById("chat");

const PLAT_COLORS = { twitch: "#9146FF", youtube: "#FF0033", tiktok: "#25F4EE", kick: "#53FC18" };

// iconos de rol de reserva (hasta tener los PNG de plastilina): formas simples en café
const SVG = {
  broadcaster: '<svg viewBox="0 0 24 24"><path fill="#4A3530" d="M3 18 4.5 7l4.5 4 3-6 3 6 4.5-4L21 18z"/></svg>',
  moderator:   '<svg viewBox="0 0 24 24"><path fill="#4A3530" d="M14 3h7v7l-9 9-3 1 1-3-4-4 3-3 4 4z"/><path fill="#4A3530" d="m3 17 4 4-2 1-3-3z"/></svg>',
  vip:         '<svg viewBox="0 0 24 24"><path fill="#4A3530" d="M6 3h12l4 6-10 12L2 9z"/></svg>',
  subscriber:  '<svg viewBox="0 0 24 24"><path fill="#4A3530" d="M12 21 3.5 12.5A5 5 0 0 1 12 6a5 5 0 0 1 8.5 6.5z"/></svg>',
  artist:      '<svg viewBox="0 0 24 24"><path fill="#4A3530" d="m12 2 3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z"/></svg>',
  regular:     '<svg viewBox="0 0 24 24"><path fill="#4A3530" d="M4 5h16v10H9l-5 4z"/></svg>',
};
const ROLE_FILE = { broadcaster: "crown", moderator: "sword", vip: "gem", subscriber: "heart", artist: "star", regular: "bubble" };

window.addEventListener("onWidgetLoad", obj => {
  F = obj.detail.fieldData || {};
  chat.classList.add(F.layout === "horizontal" ? "horizontal" : "vertical");
  if (F.align === "right") chat.classList.add("right");
  console.log("clay-chat v2");
  if (F.demo === "yes") demo();
});

window.addEventListener("onEventReceived", obj => {
  const l = obj.detail.listener, e = obj.detail.event;
  if (l === "message") addMessage(e.data, e.service || "twitch");
  else if (l === "delete-message") removeWhere(m => m.dataset.id === e.msgId);
  else if (l === "delete-messages") removeWhere(m => m.dataset.user === e.userId);
});

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function roleOf(d) {
  const types = (d.badges || []).map(b => b.type);
  for (const r of ["broadcaster", "moderator", "vip", "artist-badge", "subscriber", "founder"])
    if (types.includes(r)) return r === "artist-badge" ? "artist" : r === "founder" ? "subscriber" : r;
  return "regular";
}

function renderText(d) {
  // emotes por posición si vienen con start/end, si no por nombre
  const text = d.text || "";
  const emotes = (d.emotes || []).filter(x => x.urls);
  let html = "", onlyEmotes = true;
  const byName = {};
  emotes.forEach(x => { byName[x.name] = x.urls["4"] || x.urls["2"] || x.urls["1"]; });
  text.split(/(\s+)/).forEach(tok => {
    if (!tok) return;
    if (/^\s+$/.test(tok)) { html += " "; return; }
    if (byName[tok]) { html += `<img class="emote" src="${byName[tok]}" alt="${esc(tok)}">`; return; }
    onlyEmotes = false;
    html += tok.startsWith("@") ? `<span class="mention">${esc(tok)}</span>` : esc(tok);
  });
  return { html, onlyEmotes: onlyEmotes && emotes.length > 0 };
}

function addMessage(d, platform) {
  const nick = (d.displayName || d.nick || "").toString();
  const text = d.text || "";
  const hide = (F.hideUsers || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
  if (hide.includes(nick.toLowerCase())) return;
  if (F.hideCommands === "yes" && text.startsWith("!")) return;

  const role = roleOf(d);
  const assets = F.assets || "";
  const msg = document.createElement("div");
  msg.className = "msg pop";
  msg.dataset.id = d.msgId || "";
  msg.dataset.user = d.userId || "";

  const plat = F.platformStyle === "dot"
    ? `<span class="dot" style="background:${PLAT_COLORS[platform] || "#ccc"}"></span>`
    : `<img class="plat" src="${assets}${platform}.png" alt="">`;
  const { html, onlyEmotes } = renderText(d);
  const roleIcon = F.roleIcons === "png"
    ? `<img src="${assets}roles/${ROLE_FILE[role]}.png" alt="" onerror="this.outerHTML='${SVG[role].replace(/"/g, "&quot;")}'">`
    : SVG[role];

  msg.innerHTML =
    `<div class="role">${roleIcon}</div>` +
    `<div class="body"><div class="tag"><span class="arrow">${F.align === "right" ? "←" : "→"}</span>${plat}<span>${esc(nick)}</span></div>` +
    `<div class="bubble${onlyEmotes ? " only-emotes" : ""}">${html}</div></div>`;
  chat.appendChild(msg);

  // límite de mensajes
  const max = +F.maxMessages || 8;
  const all = chat.querySelectorAll(".msg:not(.out)");
  for (let i = 0; i < all.length - max; i++) drop(all[i]);
  // que no se salga del área
  requestAnimationFrame(() => {
    const live = [...chat.querySelectorAll(".msg:not(.out)")];
    if (chat.classList.contains("horizontal")) {
      while (live.length > 1 && live[0].getBoundingClientRect().left < 0) drop(live.shift(), true);
    } else {
      while (live.length > 1 && live[0].getBoundingClientRect().top < 0) drop(live.shift(), true);
    }
  });
  if (+F.hideAfter > 0) setTimeout(() => drop(msg), +F.hideAfter * 1000);
}

function drop(m, now) {
  if (!m || m.classList.contains("out")) return;
  if (now) { m.remove(); return; }
  m.classList.add("out");
  setTimeout(() => m.remove(), 420);
}
function removeWhere(fn) { chat.querySelectorAll(".msg").forEach(m => { if (fn(m)) drop(m); }); }

// mensajes de prueba (campo "Demo")
function demo() {
  const samples = [
    ["FLATLINE", "hi — this is a lead mod message", ["moderator"], "twitch"],
    ["NANI", "my monitor isn't working guys. I have to print out chat in order to read it..", ["broadcaster"], "twitch"],
    ["SEVEN", "@nani remember me? 👋", ["vip"], "youtube"],
    ["TRUFFLE", "Kappa Kappa", ["subscriber"], "twitch", true],
    ["TIKTOK_GUY", "this is a tiktok message !!", [], "tiktok"],
    ["KICK_USER", "subtle dots for each platform", [], "kick"],
  ];
  let i = 0;
  const go = () => {
    const [n, t, b, p, em] = samples[i++ % samples.length];
    addMessage({ displayName: n, text: t, badges: b.map(type => ({ type })), msgId: "d" + i, userId: n,
      emotes: em ? [{ name: "Kappa", urls: { 4: "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/3.0" } }] : [] }, p);
  };
  go(); setInterval(go, 2200);
}
