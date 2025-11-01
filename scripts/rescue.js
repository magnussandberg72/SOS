// ==========================
// 🆘 SOS – Rescue Mode v2.1
// Offline QR Relay prototype
// ==========================

const $ = id => document.getElementById(id);
const log = msg => {
  const l = $("log");
  const p = document.createElement("div");
  p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  l.prepend(p);
};

// === QR core loader ===
(async () => {
  if (!window.makeQRCanvas) {
    await import("./qrcore.js");
    log("QR core loaded.");
  }
})();

// ==== Room handling ====
function randomId() {
  return "room_" + Math.random().toString(36).slice(2, 8);
}
function randomKey() {
  return crypto
    .getRandomValues(new Uint8Array(16))
    .reduce((a, b) => a + ("0" + b.toString(16)).slice(-2), "");
}
function saveRoom(r) {
  localStorage.setItem("rescueRoom", JSON.stringify(r));
}
function loadRoom() {
  return JSON.parse(localStorage.getItem("rescueRoom") || "null");
}

let room = loadRoom();
if (!room) {
  room = { id: randomId(), key: randomKey() };
  saveRoom(room);
}

$("roomId").value = room.id;
$("roomKey").value = room.key;
$("chipRoom").textContent = "Room: " + room.id;

// ==== Faith mode chip ====
let faith = false;
$("chipFaith").onclick = () => {
  faith = !faith;
  $("chipFaith").textContent = faith ? "✝️ Faith ON" : "✝️ Faith OFF";
  log("Faith mode " + (faith ? "enabled" : "disabled"));
};

// ==== Room actions ====
$("btnNewRoom").onclick = () => {
  room = { id: randomId(), key: randomKey() };
  saveRoom(room);
  $("roomId").value = room.id;
  $("roomKey").value = room.key;
  $("chipRoom").textContent = "Room: " + room.id;
  log("New room generated.");
};

$("btnCopyKey").onclick = () => {
  navigator.clipboard?.writeText(room.key);
  log("Key copied.");
};

// ==== Queue & compose ====
let relayed = 0;
$("btnQueue").onclick = () => {
  const item = {
    id: $("cShelter").value || "unknown",
    people: $("cPeople").value || 0,
    injured: $("cInjured").value || 0,
    needs: ($("cNeeds").value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    note: $("cNote").value,
    status: $("cStatus").value,
    ts: new Date().toISOString(),
  };
  const payload = JSON.stringify(item, null, 2);
  $("relayBox").textContent = payload;
  log("Queued new rescue packet for " + item.id);
};

// ==== QR generation ====
$("btnQRRelay").onclick = async () => {
  const payload = $("relayBox").textContent || '{"msg":"no queued data"}';
  await makeQRCanvas(payload, "qrRoomBox");
  $("qrRoomBox").hidden = false;
  log("QR bundle displayed – ready to share.");
};

// ==== QR scan ====
$("btnScanQR").onclick = () => {
  log("Opening camera for QR scan...");
  scanQRFromCamera((data) => {
    try {
      const parsed = JSON.parse(data);
      log("Received bundle: " + JSON.stringify(parsed));
    } catch {
      log("Received plain text: " + data);
    }
  });
};

// ==== Transport placeholders ====
$("btnAudio").onclick = () => {
  log("Audio layer not yet active.");
};
$("btnBLE").onclick = () => {
  log("Bluetooth layer not yet active.");
};

// ==== Diagnostics ====
function updateChips() {
  $("chipNodes").textContent = "Nodes: " + Math.floor(Math.random() * 3);
  $("chipRelayed").textContent = "Relayed: " + relayed;
}
setInterval(updateChips, 5000);
