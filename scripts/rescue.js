// =====================================
// 🆘 SOS – Rescue Mode (v2.3 simplified)
// =====================================

// Snabbt alias
const $ = (id) => document.getElementById(id);

// Logg till konsolen i appen
function log(msg) {
  const box = $("log");
  const line = document.createElement("div");
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  box.prepend(line);
}

// === Ladda in QR-funktioner ===
(async () => {
  if (!window.makeQRCanvas) {
    await import("./qrcore.js");
    log("QR system loaded.");
  }
})();

// === Rums-system (ID & nyckel) ===
function newRoom() {
  return {
    id: "room_" + Math.random().toString(36).slice(2, 8),
    key: crypto
      .getRandomValues(new Uint8Array(16))
      .reduce((a, b) => a + ("0" + b.toString(16)).slice(-2), ""),
  };
}
function saveRoom(r) {
  localStorage.setItem("rescueRoom", JSON.stringify(r));
}
function loadRoom() {
  return JSON.parse(localStorage.getItem("rescueRoom") || "null");
}

let room = loadRoom() || newRoom();
saveRoom(room);
$("roomId").value = room.id;
$("roomKey").value = room.key;
$("chipRoom").textContent = "Room: " + room.id;

// === Faith-läge ===
let faith = false;
$("chipFaith").onclick = () => {
  faith = !faith;
  $("chipFaith").textContent = faith ? "✝️ Faith ON" : "✝️ Faith OFF";
  log("Faith mode " + (faith ? "enabled" : "disabled"));
};

// === Shelter-databas ===
function loadDB() {
  return JSON.parse(localStorage.getItem("rescueDB") || "{}");
}
function saveDB(db) {
  localStorage.setItem("rescueDB", JSON.stringify(db));
}
let DB = loadDB();

// === Visa shelters på skärmen ===
function renderShelters() {
  const box = $("shelterList");
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
        <span>👥 ${s.people}</span>
        <span>🩹 ${s.injured}</span>
        <span>⏱ ${new Date(s.ts).toLocaleTimeString()}</span>
        <div>📝 ${s.note || ""}</div>
      </div>`;
    box.appendChild(card);
  });
}

// === Lägga till shelter ===
$("btnQueue").onclick = () => {
  const s = {
    shelterId: $("cShelter").value || "unknown",
    people: Number($("cPeople").value || 0),
    injured: Number($("cInjured").value || 0),
    needs: ($("cNeeds").value || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    note: $("cNote").value,
    status: $("cStatus").value,
    ts: new Date().toISOString(),
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

// === QR export ===
$("btnQRRelay").onclick = async () => {
  const payload = JSON.stringify(DB);
  await makeQRCanvas(payload, "qrRoomBox");
  $("qrRoomBox").hidden = false;
  log("QR with " + Object.keys(DB).length + " shelters ready.");
};

// === QR import ===
$("btnScanQR").onclick = () => {
  log("Scanning QR...");
  scanQRFromCamera((data) => {
    let incoming = {};
    try {
      incoming = JSON.parse(data);
    } catch {
      log("Invalid QR data.");
      return;
    }

    let updated = 0;
    for (const [id, s] of Object.entries(incoming)) {
      const old = DB[id];
      if (!old || new Date(s.ts) > new Date(old.ts)) {
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
  });
};

// === Övriga knappar ===
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

// === Statuschips ===
let relayed = 0;
function updateChips() {
  $("chipNodes").textContent = "Nodes: " + Math.floor(Math.random() * 3);
  $("chipRelayed").textContent = "Relayed: " + relayed;
}
setInterval(updateChips, 5000);

// === Start ===
renderShelters();
log("Rescue Mode ready.");
