// =======================================
// SOS Rescue & Health Center v1.0
// Offline-first, localStorage based
// =======================================
const $ = id => document.getElementById(id);

const STORE_KEY = "sos.health";
const META_KEY  = "sos.health.meta"; // shelterId, lastUpdate

/* ---------- Load / Save ---------- */
function loadHealth(){
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
  catch { return {}; }
}
function saveHealth(data){
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  meta.lastUpdate = new Date().toLocaleString();
  saveMeta();
  renderMeta();
}
function loadMeta(){
  try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); }
  catch { return {}; }
}
function saveMeta(){
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

/* ---------- State ---------- */
let health = loadHealth();
if(!health.people)   health.people = [];
if(!health.supplies) health.supplies = [];

let meta = loadMeta();
if(!meta.shelterId) meta.shelterId = "";

/* ---------- Elements ---------- */
const netChip = $("netChip");
const lastUpdate = $("lastUpdate");
const offlineBanner = $("offlineBanner");
const shelterId = $("shelterId");

const pName = $("pName");
const pStatus = $("pStatus");
const pInjury = $("pInjury");
const pNotes = $("pNotes");
const peopleList = $("peopleList");
const addPerson = $("addPerson");
const clearPeople = $("clearPeople");

const sItem = $("sItem");
const sAmount = $("sAmount");
const suppliesList = $("suppliesList");
const addSupply = $("addSupply");
const clearSupplies = $("clearSupplies");

const genReport = $("genReport");
const copyReport = $("copyReport");
const reportBox = $("reportBox");
const clearAll = $("clearAll");

/* ---------- Network status ---------- */
function updateNet(){
  if(navigator.onLine){
    netChip.textContent = "Online";
    netChip.className = "chip online";
    offlineBanner.classList.add("hidden");
  }else{
    netChip.textContent = "Offline";
    netChip.className = "chip offline";
    offlineBanner.classList.remove("hidden");
  }
}
window.addEventListener("online", updateNet);
window.addEventListener("offline", updateNet);
updateNet();

/* ---------- Meta ---------- */
function renderMeta(){
  lastUpdate.textContent = "Last update: " + (meta.lastUpdate || "—");
  shelterId.value = meta.shelterId || "";
}
shelterId.oninput = () => {
  meta.shelterId = shelterId.value.trim();
  saveMeta();
  renderMeta();
};
renderMeta();

/* ---------- People ---------- */
function statusTagClass(s){
  switch(s){
    case "Safe": return "tag safe";
    case "Injured": return "tag injured";
    case "Critical": return "tag critical";
    case "Deceased": return "tag deceased";
    default: return "tag";
  }
}
function renderPeople(){
  peopleList.innerHTML = "";
  // header
  const head = document.createElement("div");
  head.className = "row header-row";
  head.innerHTML = `
    <div>Name</div>
    <div>Status</div>
    <div>Injury/Symptom</div>
    <div>Notes</div>
    <div> </div>
  `;
  peopleList.appendChild(head);

  health.people.forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div>${escapeHtml(p.name)}</div>
      <div><span class="${statusTagClass(p.status)}">${escapeHtml(p.status)}</span></div>
      <div>${escapeHtml(p.injury||"")}</div>
      <div>${escapeHtml(p.notes||"")}</div>
      <div><button class="del" data-idx="${idx}">Delete</button></div>
    `;
    // Click status tag to cycle
    row.querySelector("span").onclick = () => {
      const order = ["Safe","Injured","Critical","Deceased"];
      const cur = order.indexOf(p.status);
      p.status = order[(cur+1)%order.length];
      saveHealth(health);
      renderPeople();
    };
    // Delete
    row.querySelector(".del").onclick = (e) => {
      const i = Number(e.currentTarget.dataset.idx);
      health.people.splice(i,1);
      saveHealth(health);
      renderPeople();
    };
    peopleList.appendChild(row);
  });
}
addPerson.onclick = () => {
  const name = pName.value.trim();
  if(!name){ alert("Name is required"); return; }
  const person = {
    name,
    status: (pStatus.value || "Safe"),
    injury: pInjury.value.trim(),
    notes: pNotes.value.trim()
  };
  health.people.push(person);
  saveHealth(health);
  pName.value = ""; pInjury.value = ""; pNotes.value = "";
  pStatus.value = "Safe";
  renderPeople();
};
clearPeople.onclick = () => {
  if(!confirm("Clear ALL people?")) return;
  health.people = [];
  saveHealth(health);
  renderPeople();
};

/* ---------- Supplies ---------- */
function renderSupplies(){
  suppliesList.innerHTML = "";
  // header
  const head = document.createElement("div");
  head.className = "srow header-row";
  head.innerHTML = `
    <div>Item</div>
    <div>Amount</div>
    <div> </div>
  `;
  suppliesList.appendChild(head);

  health.supplies.forEach((s, idx) => {
    const row = document.createElement("div");
    row.className = "srow";
    row.innerHTML = `
      <div>${escapeHtml(s.item)}</div>
      <div>${escapeHtml(s.amount)}</div>
      <div><button class="del" data-idx="${idx}">Delete</button></div>
    `;
    row.querySelector(".del").onclick = (e) => {
      const i = Number(e.currentTarget.dataset.idx);
      health.supplies.splice(i,1);
      saveHealth(health);
      renderSupplies();
    };
    suppliesList.appendChild(row);
  });
}
addSupply.onclick = () => {
  const item = sItem.value.trim();
  const amount = sAmount.value.trim();
  if(!item){ alert("Item is required"); return; }
  health.supplies.push({item, amount});
  saveHealth(health);
  sItem.value = ""; sAmount.value = "";
  renderSupplies();
};
clearSupplies.onclick = () => {
  if(!confirm("Clear ALL supplies?")) return;
  health.supplies = [];
  saveHealth(health);
  renderSupplies();
};

/* ---------- Report ---------- */
function generateReport(){
  const ts = new Date().toLocaleString();
  const id = meta.shelterId || "—";
  const ppl = health.people;
  const sup = health.supplies;

  let safe=0, inj=0, crit=0, dec=0;
  ppl.forEach(p=>{
    if(p.status==="Safe") safe++;
    else if(p.status==="Injured") inj++;
    else if(p.status==="Critical") crit++;
    else if(p.status==="Deceased") dec++;
  });

  const lines = [];
  lines.push(`SOS Health Report — Shelter: ${id}`);
  lines.push(`Date: ${ts}`);
  lines.push("");
  lines.push("People:");
  if(ppl.length===0){ lines.push("- (none)"); }
  else {
    ppl.forEach(p=>{
      const injLine = p.injury ? ` (${p.injury})` : "";
      const notes = p.notes ? ` → ${p.notes}` : "";
      lines.push(`- ${p.name} — ${p.status}${injLine}${notes}`);
    });
  }
  lines.push("");
  lines.push("Supplies:");
  if(sup.length===0){ lines.push("- (none)"); }
  else {
    sup.forEach(s=> lines.push(`- ${s.item}: ${s.amount||"(n/a)"}`));
  }
  lines.push("");
  lines.push("Summary:");
  lines.push(`${ppl.length} total — Safe: ${safe}, Injured: ${inj}, Critical: ${crit}, Deceased: ${dec}.`);
  lines.push("Report generated locally (offline-first).");

  reportBox.value = lines.join("\n");
}
genReport.onclick = generateReport;

copyReport.onclick = async () => {
  try{
    await navigator.clipboard.writeText(reportBox.value || "");
    alert("Report copied.");
  }catch{
    // Fallback: select text
    reportBox.select();
    document.execCommand("copy");
    alert("Report copied (fallback).");
  }
};

clearAll.onclick = () => {
  if(!confirm("Reset ALL data (people & supplies)?")) return;
  health = { people: [], supplies: [] };
  saveHealth(health);
  renderPeople();
  renderSupplies();
  reportBox.value = "";
};

/* ---------- Helpers ---------- */
function escapeHtml(s=""){ return s.replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

/* ---------- Initial render ---------- */
renderPeople();
renderSupplies();

/* ---------- Done ---------- */
console.log("Rescue & Health Center loaded ✅");
