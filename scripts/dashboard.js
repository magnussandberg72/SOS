// ==========================================
// Shelter Dashboard v1.0  (offline-first)
// ==========================================
const $ = id => document.getElementById(id);

/* ------------- Elements ------------- */
const offlineBanner = $("offlineBanner");
const netChip = $("netChip");
const battLevel = $("battLevel");
const battState = $("battState");
const timeNow = $("timeNow");
const lastSync = $("lastSync");
const radioNow = $("radioNow");
const msgList = $("msgList");
const verseText = $("verseText");

/* ------------- Radio ---------------- */

function readRadioState(){
  try { return JSON.parse(localStorage.getItem("radio.state") || "null"); }
  catch { return null; }
}

function renderRadioState(){
  const st = readRadioState();
  if(!st){
    radioNow.textContent = "Not playing.";
    return;
  }
  if(st.mode === "calm"){
    radioNow.textContent = `🕊️ Calm Loop: ${st.label || "Local audio"}`;
    return;
  }
  if(st.connecting){
    radioNow.textContent = `⏳ Connecting: ${st.label || st.id || "—"}`;
    return;
  }
  if(st.playing){
    radioNow.textContent = `🎶 Playing: ${st.label || st.id || "—"}`;
    return;
  }
  if(st.error){
    radioNow.textContent = `⚠️ Radio error — ${st.reason || "check connection"}`;
    return;
  }
  radioNow.textContent = st.label ? `Last channel: ${st.label}` : "Not playing.";
}

// uppdatera var 2s så dashboard följer radion
renderRadioState();
setInterval(renderRadioState, 2000);

/* ------------- Network -------------- */
function updateNet(){
  if(navigator.onLine){
    netChip.textContent = "Online";
    netChip.className = "chip online";
    offlineBanner?.classList.add("hidden");
  }else{
    netChip.textContent = "Offline";
    netChip.className = "chip offline";
    offlineBanner?.classList.remove("hidden");
  }
}
window.addEventListener("online",updateNet);
window.addEventListener("offline",updateNet);
updateNet();

/* ------------- Time loop ------------ */
function updateClock(){
  const d = new Date();
  timeNow.textContent = d.toLocaleString();
}
updateClock();
setInterval(updateClock,60000);

/* ------------- Battery -------------- */
if(navigator.getBattery){
  navigator.getBattery().then(b=>{
    function update(){
      battLevel.textContent = "Battery: " + Math.round(b.level*100) + "%";
      battState.textContent = "Charging: " + (b.charging?"Yes":"No");
      if(b.level<0.3 && !b.charging) battLevel.style.color="#ff7777";
      else battLevel.style.color="#cfd7eb";
    }
    update();
    b.addEventListener("levelchange",update);
    b.addEventListener("chargingchange",update);
  });
}

/* ------------- Messages ------------- */
function loadMessages(){
  try{
    const msgs = JSON.parse(localStorage.getItem("sos.messages")||"[]");
    return msgs.slice().sort((a,b)=>a.timestamp<b.timestamp?1:-1).slice(0,5);
  }catch{return [];}
}
function renderMessages(){
  const msgs = loadMessages();
  msgList.innerHTML = "";
  if(msgs.length===0){ msgList.innerHTML="<p>No messages.</p>"; return; }
  msgs.forEach(m=>{
    const div=document.createElement("div");
    div.className="msg";
    div.textContent=`${new Date(m.timestamp).toLocaleTimeString()} ${m.group}: ${m.preview||m.message}`;
    msgList.appendChild(div);
  });
}
renderMessages();

/* ------------- Shelter Data ---------- */
const people=$("people"),injured=$("injured"),water=$("water"),food=$("food");
const saveShelter=$("saveShelter");
const SHELTER_KEY="sos.shelterData";

function loadShelter(){
  try{ return JSON.parse(localStorage.getItem(SHELTER_KEY)||"{}"); }catch{return{};}
}
function saveShelterData(data){
  localStorage.setItem(SHELTER_KEY, JSON.stringify(data));
}
function renderShelter(){
  const d=loadShelter();
  people.value=d.people||"";
  injured.value=d.injured||"";
  water.value=d.waterLiters||"";
  food.value=d.foodDays||"";
}
renderShelter();

saveShelter.onclick=()=>{
  const data={
    people:Number(people.value)||0,
    injured:Number(injured.value)||0,
    waterLiters:Number(water.value)||0,
    foodDays:Number(food.value)||0,
    lastUpdate:new Date().toISOString()
  };
  saveShelterData(data);
  alert("Shelter data saved locally.");
};

/* ------------- Sync Info ------------- */
try{
  const meta=JSON.parse(localStorage.getItem("sos.meta")||"{}");
  if(meta.lastSync) lastSync.textContent="Last sync: "+meta.lastSync;
}catch{}

/* ------------- Radio widget ---------- */
$("radioBtn").onclick=()=>{ window.location.href="radio.html"; };
try{
  // show last played from radio.settings
  const r=JSON.parse(localStorage.getItem("radio.settings")||"{}");
  if(r.lastChannel) radioNow.textContent="Now playing: "+r.lastChannel.label;
}catch{}

/* ------------- Message Center btn ---- */
$("msgBtn").onclick=()=>{ window.location.href="message.html"; };

/* ------------- Verse of Hope ---------- */
const VERSES=[
  "Psalm 46:1 — God is our refuge and strength, a very present help in trouble.",
  "Isaiah 26:3 — You will keep in perfect peace those whose minds are steadfast.",
  "John 14:27 — Peace I leave with you; my peace I give to you.",
  "Romans 8:28 — In all things God works for the good of those who love Him.",
  "Matthew 5:9 — Blessed are the peacemakers, for they shall be called sons of God."
];
$("verseBtn").onclick=()=>{
  const v=VERSES[Math.floor(Math.random()*VERSES.length)];
  verseText.textContent=v;
};
$("readBtn").onclick=()=>{
  if('speechSynthesis' in window){
    const msg=new SpeechSynthesisUtterance(verseText.textContent);
    msg.lang="en-US";
    window.speechSynthesis.speak(msg);
  }else alert("Speech not supported in this browser.");
};

/* ------------- Boot done ------------- */
console.log("Shelter Dashboard loaded ✅");
