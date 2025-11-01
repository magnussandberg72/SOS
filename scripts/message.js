// ===================================
// SOS Message Center (offline-first)
// ===================================
const $ = id => document.getElementById(id);

/* ------------------ State ------------------ */
const LS_KEY = "sos.messages";
const LS_META = "sos.meta"; // group, author, encKey, lastSync
let messages = loadMessages();
let meta = loadMeta();

function loadMessages(){
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
  catch { return []; }
}
function saveMessages(){
  localStorage.setItem(LS_KEY, JSON.stringify(messages));
}
function loadMeta(){
  try { return JSON.parse(localStorage.getItem(LS_META) || "{}"); }
  catch { return {}; }
}
function saveMeta(){
  localStorage.setItem(LS_META, JSON.stringify(meta));
}

/* --------------- Verses (EN) --------------- */
const VERSES = [
  "Psalm 46:1 — God is our refuge and strength, a very present help in trouble.",
  "Isaiah 41:10 — Fear not, for I am with you; be not dismayed, for I am your God.",
  "John 16:33 — In the world you will have tribulation. But take heart; I have overcome the world.",
  "Psalm 23:4 — Even though I walk through the valley of the shadow of death, I will fear no evil.",
  "Philippians 4:7 — The peace of God... will guard your hearts and your minds in Christ Jesus."
];
function randomVerse(){ return VERSES[Math.floor(Math.random()*VERSES.length)]; }

/* --------- Crypto (AES-GCM simple) ---------- */
async function deriveKey(keyString){
  const raw = new TextEncoder().encode((keyString||"").padEnd(32,"x").slice(0,32));
  return crypto.subtle.importKey("raw", raw, {name:"AES-GCM"}, false, ["encrypt","decrypt"]);
}
async function encryptText(plain, keyString){
  const key = await deriveKey(keyString);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plain);
  const buf = await crypto.subtle.encrypt({name:"AES-GCM", iv}, key, enc);
  const all = new Uint8Array(iv.byteLength + buf.byteLength);
  all.set(iv,0); all.set(new Uint8Array(buf), iv.byteLength);
  return btoa(String.fromCharCode(...all));
}
async function decryptText(b64, keyString){
  try{
    const key = await deriveKey(keyString);
    const data = Uint8Array.from(atob(b64), c=>c.charCodeAt(0));
    const iv = data.slice(0,12);
    const ct = data.slice(12);
    const buf = await crypto.subtle.decrypt({name:"AES-GCM", iv}, key, ct);
    return new TextDecoder().decode(buf);
  }catch{
    return null; // bad key or corrupted
  }
}

/* ----------- UI init / bind ----------------- */
const group = $("group");
const author = $("author");
const msg = $("msg");
const addVerse = $("addVerse");
const useEnc = $("useEnc");
const encKey = $("encKey");
const netStatus = $("netStatus");
const syncInfo = $("syncInfo");
const unsentChip = $("unsentChip");
const logBox = $("log");

group.value = meta.group || "";
author.value = meta.author || "";
encKey.value = meta.encKey || "";

group.oninput = () => { meta.group = group.value.trim(); saveMeta(); };
author.oninput = () => { meta.author = author.value.trim(); saveMeta(); };
encKey.oninput = () => { meta.encKey = encKey.value; saveMeta(); };

/* ------------- Network status --------------- */
function updateNet(){
  if(navigator.onLine){
    netStatus.textContent = "Online";
    netStatus.className = "chip online";
  }else{
    netStatus.textContent = "Offline";
    netStatus.className = "chip offline";
  }
}
window.addEventListener("online", updateNet);
window.addEventListener("offline", updateNet);
updateNet();

/* -------------- Render log ------------------ */
function render(){
  // unsent
  const unsent = messages.filter(m=>!m.synced).length;
  unsentChip.textContent = `Unsent: ${unsent}`;

  // sync info
  syncInfo.textContent = "Last sync: " + (meta.lastSync || "—");

  // list
  logBox.innerHTML = "";
  messages
    .slice()
    .sort((a,b)=> (a.timestamp<b.timestamp?1:-1))
    .forEach(m=>{
      const d = document.createElement("div");
      d.className = "msg";
      const tags = [
        m.synced ? `<span class="badge sent">SENT</span>` : `<span class="badge local">LOCAL</span>`,
        m.encrypted ? `<span class="badge enc">ENC</span>` : ""
      ].join(" ");
      d.innerHTML = `
        <div class="meta">
          <span>${new Date(m.timestamp).toLocaleTimeString()}</span>
          <span>${m.author || "Anonymous"}</span>
          <span>${m.group}</span>
          ${tags}
        </div>
        <div class="body">${escapeHtml(m.preview || m.message)}</div>
        ${m.verse ? `<div class="meta">✝️ ${escapeHtml(m.verse)}</div>` : ""}`;
      logBox.appendChild(d);
    });
}
function escapeHtml(s=""){
  return s.replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/* ---------------- Send ---------------------- */
$("sendBtn").onclick = async () => {
  const g = (group.value||"").trim();
  const a = (author.value||"").trim();
  const text = (msg.value||"").trim();
  if(!g || !text){ alert("Group and message are required."); return; }

  const verse = addVerse.checked ? randomVerse() : "";
  const encrypted = !!useEnc.checked;
  const key = encKey.value || "";

  let storeText = text;
  let preview = text;

  if(encrypted){
    const enc = await encryptText(text, key);
    storeText = enc;
    preview = "[encrypted]";
  }

  const item = {
    id: Date.now().toString(),
    group: g,
    author: a,
    message: storeText,
    preview,
    encrypted,
    timestamp: new Date().toISOString(),
    synced: false,
    verse
  };

  messages.push(item);
  saveMessages();
  msg.value = "";
  render();
};

/* ---------------- Sync ---------------------- */
/* Notera: Ren HTML-app har ingen skrivbar server-JSON.
   Vi gör tre steg:
   1) Online? markera 'synced' lokalt (så logiken funkar).
   2) Försök POST till /api/messages (om du kopplar en endpoint).
   3) Om POST misslyckas: rulla tillbaka 'synced=false'. */
$("syncBtn").onclick = async () => {
  const pending = messages.filter(m=>!m.synced);
  if(pending.length===0){ meta.lastSync = new Date().toLocaleTimeString(); saveMeta(); render(); return; }

  netStatus.className = "chip syncing"; netStatus.textContent = "Syncing";

  // Optimistisk markering
  pending.forEach(m=>m.synced=true);
  saveMessages(); render();

  let ok = false;
  if(navigator.onLine){
    try{
      // Byt till din server-endpoint om/när du har en.
      // const res = await fetch("/api/messages", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(pending)});
      // ok = res.ok;

      // I ren PWA utan backend: simulera lyckad sync.
      ok = true;
    }catch{ ok = false; }
  }

  if(ok){
    meta.lastSync = new Date().toLocaleTimeString();
    saveMeta();
    netStatus.className = "chip online"; netStatus.textContent = "Online";
    render();
  }else{
    // rulla tillbaka
    messages.forEach(m=>{ if(pending.find(p=>p.id===m.id)) m.synced=false; });
    saveMessages();
    netStatus.className = "chip error"; netStatus.textContent = "Sync error";
    render();
  }
};

/* -------------- Clear log ------------------- */
$("clearBtn").onclick = () => {
  if(!confirm("Clear ALL local messages? This cannot be undone.")) return;
  messages = [];
  saveMessages();
  render();
};

/* -------------- Helper: decrypt all locally (optional preview tool)
   Aktivera vid behov — här visar vi bara [encrypted] för säkerhet.
------------------------------------------------ */

/* -------------- Boot ------------------------ */
render();
