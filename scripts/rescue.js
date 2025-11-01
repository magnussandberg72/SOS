// ===========================================
// 🆘 SOS – Rescue Mode (v2.4 Multi-QR Sync)
// ===========================================

const $ = (id) => document.getElementById(id);

/* ---------------- Log & helpers ---------------- */
function log(msg) {
  const box = $("log");
  if (!box) return;
  const line = document.createElement("div");
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  box.prepend(line);
}
function isoNow() { return new Date().toISOString(); }

/* -------- Load QR helpers (qrcore.js) ---------- */
(async () => {
  if (!window.makeQRCanvas) {
    await import("./qrcore.js");
    log("QR system loaded.");
  }
})();

/* --------------- Room (id/key) ------------------ */
function newRoom() {
  return {
    id: "room_" + Math.random().toString(36).slice(2, 8),
    key: crypto.getRandomValues(new Uint8Array(16))
          .reduce((a,b)=>a+("0"+b.toString(16)).slice(-2),""),
  };
}
function saveRoom(r){ localStorage.setItem("rescueRoom", JSON.stringify(r)); }
function loadRoom(){ return JSON.parse(localStorage.getItem("rescueRoom")||"null"); }

let room = loadRoom() || newRoom();
saveRoom(room);

$("roomId").value = room.id;
$("roomKey").value = room.key;
$("chipRoom").textContent = "Room: " + room.id;

/* ---------------- Faith mode -------------------- */
let faith = false;
$("chipFaith").onclick = () => {
  faith = !faith;
  $("chipFaith").textContent = faith ? "✝️ Faith ON" : "✝️ Faith OFF";
  log("Faith mode " + (faith ? "enabled" : "disabled"));
};

/* ---------------- Local DB ---------------------- */
function loadDB(){ return JSON.parse(localStorage.getItem("rescueDB")||"{}"); }
function saveDB(db){ localStorage.setItem("rescueDB", JSON.stringify(db)); }
let DB = loadDB();

/* --------- Render list of shelters -------------- */
function renderShelters() {
  const box = $("shelterList");
  if (!box) return;
  box.innerHTML = "";
  const ids = Object.keys(DB);
  if (ids.length === 0) {
    box.innerHTML = "<p style='color:#ccc;'>No shelters saved yet.</p>";
    return;
  }
  ids.forEach((id) => {
    const s = DB[id];
    const card = document.createElement("div");
    card.className = "shelter-item";
    const statusClass = "status-" + (s.status || "unknown");
    card.innerHTML = `
      <div class="shelter-head">
        <div>${id}</div>
        <div class="shelter-status ${statusClass}">${s.status}</div>
      </div>
      <div class="shelter-body">
        <span>👥 ${Number(s.people)||0}</span>
        <span>🩹 ${Number(s.injured)||0}</span>
        <span>⏱ ${new Date(s.ts||isoNow()).toLocaleTimeString()}</span>
        <div>📝 ${s.note || ""}</div>
      </div>`;
    box.appendChild(card);
  });
}

/* -------------- Compose / Queue ----------------- */
$("btnQueue").onclick = () => {
  const s = {
    shelterId: $("cShelter").value || "unknown",
    people: Number($("cPeople").value || 0),
    injured: Number($("cInjured").value || 0),
    needs: ($("cNeeds").value || "").split(",").map(v=>v.trim()).filter(Boolean),
    note: $("cNote").value,
    status: $("cStatus").value,
    ts: isoNow(),
  };
  const old = DB[s.shelterId];
  if (!old || new Date(s.ts) > new Date(old.ts)) {
    DB[s.shelterId] = s;
    saveDB(DB);
    renderShelters();
    log("Shelter saved: " + s.shelterId);
  } else {
    log("Older data ignored for " + s.shelterId);
  }
  $("relayBox").textContent = JSON.stringify(s, null, 2);
};

/* --------------- Multi-QR Export ----------------
   Vi delar databasen i mindre delar. Varje del är ett paket:
   { t:"SOS-QR", v:"2.4", id:<transferId>, part:<1..N>, total:N, data:{ ...subset... } }
-------------------------------------------------- */
let relayed = 0;
let currentParts = null; // array of chunks
let currentPartIndex = 0;
let currentTransferId = null;

function uuid4() {
  // enkel UUID v4 (tillräckligt för lokal identitet)
  const u = crypto.getRandomValues(new Uint8Array(16));
  u[6] = (u[6] & 0x0f) | 0x40;
  u[8] = (u[8] & 0x3f) | 0x80;
  return [...u].map((b,i)=> (i===4||i===6||i===8||i===10? "-" : "") + b.toString(16).padStart(2,"0")).join("").slice(1);
}

function splitDBToChunks(db, maxItemsPerPart=3, maxCharsPerQR=1800) {
  // Bygg små del-paket baserat på item-count och ungefärlig storlek.
  const ids = Object.keys(db);
  if (ids.length === 0) return [];

  const chunks = [];
  let buf = {};
  let count = 0;
  let approxSize = 2; // {}

  for (const id of ids) {
    const obj = db[id];
    const piece = JSON.stringify({[id]: obj});
    const wouldBe = approxSize + piece.length + (count>0?1:0);

    if (count >= maxItemsPerPart || wouldBe > maxCharsPerQR) {
      chunks.push(buf);
      buf = {};
      count = 0;
      approxSize = 2;
    }
    buf[id] = obj;
    count++;
    approxSize = wouldBe;
  }
  if (count > 0) chunks.push(buf);
  return chunks;
}

function ensureQRControls() {
  // Skapar Next/Prev-knappar under QR-rutan om de inte finns
  let ctrl = document.getElementById("qrControls");
  if (!ctrl) {
    ctrl = document.createElement("div");
    ctrl.id = "qrControls";
    ctrl.style.marginTop = "8px";
    ctrl.style.display = "flex";
    ctrl.style.gap = "8px";
    ctrl.style.justifyContent = "center";
    const prev = document.createElement("button");
    prev.id = "btnQRPrev";
    prev.className = "btn ghost";
    prev.textContent = "◀️ Prev";
    const next = document.createElement("button");
    next.id = "btnQRNext";
    next.className = "btn";
    next.textContent = "Next ▶️";
    const info = document.createElement("span");
    info.id = "qrInfo";
    info.style.display = "inline-block";
    info.style.marginLeft = "8px";
    info.style.color = "#ddd";
    ctrl.appendChild(prev);
    ctrl.appendChild(next);
    ctrl.appendChild(info);
    $("qrRoomBox").after(ctrl);
  }
}

async function showQRPart(idx) {
  if (!currentParts) return;
  const total = currentParts.length;
  idx = Math.max(0, Math.min(idx, total - 1));
  currentPartIndex = idx;

  const payload = {
    t: "SOS-QR",
    v: "2.4",
    id: currentTransferId,
    part: idx + 1,
    total,
    ts: isoNow(),
    data: currentParts[idx]
  };
  await makeQRCanvas(JSON.stringify(payload), "qrRoomBox");
  $("qrRoomBox").hidden = false;

  const info = document.getElementById("qrInfo");
  if (info) info.textContent = `Part ${payload.part} of ${payload.total}`;
}

$("btnQRRelay").onclick = async () => {
  const size = Object.keys(DB).length;
  if (size === 0) {
    await makeQRCanvas(JSON.stringify(DB), "qrRoomBox");
    $("qrRoomBox").hidden = false;
    log("QR ready (empty DB).");
    return;
  }
  currentTransferId = uuid4();
  currentParts = splitDBToChunks(DB, 3, 1800);
  ensureQRControls();
  await showQRPart(0);
  relayed++;
  log(`QR sequence ready (${currentParts.length} parts).`);
};

document.addEventListener("click", async (e) => {
  if (e.target && e.target.id === "btnQRNext") {
    if (!currentParts) return;
    if (currentPartIndex < currentParts.length - 1) {
      await showQRPart(currentPartIndex + 1);
    } else {
      log("✅ All QR parts displayed.");
    }
  }
  if (e.target && e.target.id === "btnQRPrev") {
    if (!currentParts) return;
    if (currentPartIndex > 0) {
      await showQRPart(currentPartIndex - 1);
    }
  }
});

/* --------------- Multi-QR Import ----------------
   Tar emot antingen:
   - v2.4 delpaket {t:'SOS-QR', id, part, total, data:{...}}
   - v2.3 full DB (ett enda JSON-objekt med shelters)
-------------------------------------------------- */

function partsKey(id){ return `qrParts_${id}`; }
function loadPartsState(id){
  return JSON.parse(sessionStorage.getItem(partsKey(id))||"null");
}
function savePartsState(id, state){
  sessionStorage.setItem(partsKey(id), JSON.stringify(state));
}
function clearPartsState(id){ sessionStorage.removeItem(partsKey(id)); }

function tryMergeFullDB(incomingDB){
  let updated = 0;
  for (const [id, s] of Object.entries(incomingDB)) {
    const old = DB[id];
    if (!old || new Date(s.ts||isoNow()) > new Date(old.ts||"1970-01-01T00:00:00Z")) {
      DB[id] = s;
      updated++;
    }
  }
  if (updated > 0) {
    saveDB(DB);
    renderShelters();
    log(`Merged ${updated} updated shelters.`);
  } else {
    log("No new data found.");
  }
}

$("btnScanQR").onclick = () => {
  log("Scanning QR...");
  scanQRFromCamera((data) => {
    // Försök parsning
    let parsed;
    try { parsed = JSON.parse(data); }
    catch { log("Invalid QR data."); return; }

    // v2.4 del-paket?
    if (parsed && parsed.t === "SOS-QR" && parsed.v && parsed.id && parsed.part && parsed.total && parsed.data) {
      const id = parsed.id;
      let state = loadPartsState(id) || { total: parsed.total, parts: {}, received: 0 };
      if (!state.parts[parsed.part]) {
        state.parts[parsed.part] = parsed.data;
        state.received = Object.keys(state.parts).length;
        savePartsState(id, state);
        log(`Received part ${parsed.part}/${state.total} for ${id}.`);
      } else {
        log(`Duplicate part ${parsed.part} ignored.`);
      }

      // komplett?
      if (state.received === state.total) {
        // Slå ihop alla delars data till en DB
        const merged = {};
        for (let i=1; i<=state.total; i++){
          Object.assign(merged, state.parts[i]);
        }
        tryMergeFullDB(merged);
        clearPartsState(id);
        log(`✅ All parts received for ${id} – database merged.`);
      } else {
        log(`Waiting for remaining parts (${state.received}/${state.total}).`);
      }
      return;
    }

    // v2.3 (full DB i en QR)
    if (parsed && typeof parsed === "object" && !parsed.t) {
      tryMergeFullDB(parsed);
      return;
    }

    log("Unrecognized QR payload.");
  });
});

/* ---------------- Misc buttons ------------------ */
$("btnNewRoom").onclick = () => {
  room = newRoom();
  saveRoom(room);
  $("roomId").value = room.id;
  $("roomKey").value = room.key;
  $("chipRoom").textContent = "Room: " + room.id;
  log("New room created.");
};
$("btnCopyKey").onclick = () => {
  navigator.clipboard?.writeText(room.key);
  log("Key copied to clipboard.");
};
$("btnAudio").onclick = () => log("Audio mode not ready.");
$("btnBLE").onclick = () => log("Bluetooth mode not ready.");

/* ---------------- Chips (diag) ------------------ */
function updateChips() {
  $("chipNodes").textContent = "Nodes: " + Math.floor(Math.random() * 3);
  $("chipRelayed").textContent = "Relayed: " + relayed;
}
setInterval(updateChips, 5000);

/* ---------------- Boot -------------------------- */
renderShelters();
log("Rescue Mode ready (v2.4).");
