// ===================================
// SOS Radio v3.1  (Dashboard-linked)
// ===================================
const $ = id => document.getElementById(id);

/* -----------------------------------
   Dashboard sync helper
----------------------------------- */
function saveRadioState(state){
  try { localStorage.setItem("radio.state", JSON.stringify(state)); } catch {}
}

/* -----------------------------------
   Elements
----------------------------------- */
const player = $("radioPlayer");
const statusEl = $("status");
const recon = $("recon");
const reconSec = $("reconSec");
const nowPlaying = $("nowPlaying");
const alertsBox = $("alertsBox");
const vol = $("vol");
const muteBtn = $("muteBtn");
const retryBtn = $("retryBtn");

const tabSweden = $("tabSweden");
const tabWorld = $("tabWorld");
const chSweden = $("channelsSweden");
const chWorld = $("channelsWorld");

/* -----------------------------------
   Network status
----------------------------------- */
function updateStatusChip(state){
  statusEl.className = "status " + state;
  statusEl.textContent = state[0].toUpperCase()+state.slice(1);
}
function updateNetwork(){
  updateStatusChip(navigator.onLine ? "online" : "offline");
}
window.addEventListener("online",updateNetwork);
window.addEventListener("offline",updateNetwork);
updateNetwork();

/* -----------------------------------
   Tabs
----------------------------------- */
function setTab(which){
  if(which==="sweden"){
    tabSweden.classList.add("active"); tabWorld.classList.remove("active");
    chSweden.classList.add("visible"); chWorld.classList.remove("visible");
  } else {
    tabWorld.classList.add("active"); tabSweden.classList.remove("active");
    chWorld.classList.add("visible"); chSweden.classList.remove("visible");
  }
}
tabSweden.onclick=()=>setTab("sweden");
tabWorld.onclick=()=>setTab("world");

/* -----------------------------------
   Persisted settings
----------------------------------- */
const LSKEY = "radio.settings";
function loadSettings(){ try{return JSON.parse(localStorage.getItem(LSKEY)||"{}")}catch{return{}} }
function saveSettings(s){ localStorage.setItem(LSKEY, JSON.stringify(s)) }
let settings = loadSettings();
if(typeof settings.volume==="number"){ player.volume = Math.min(1, Math.max(0, settings.volume)); vol.value = player.volume; }
else { player.volume = 0.9; vol.value = 0.9; }

vol.oninput = ()=>{ player.volume = Number(vol.value); settings.volume = player.volume; saveSettings(settings); };
muteBtn.onclick = ()=>{
  player.muted = !player.muted;
  muteBtn.textContent = player.muted ? "Unmute" : "Mute";
};

/* -----------------------------------
   State machine / reconnect
----------------------------------- */
let current = null;
let retryCount = 0;
const steps = [2,5,10,30];
let reconTimer = null, waitTimer = null;

function nextDelay(){ return steps[Math.min(retryCount, steps.length-1)]; }
function clearTimers(){
  if(reconTimer){ clearInterval(reconTimer); reconTimer=null; }
  if(waitTimer){ clearTimeout(waitTimer); waitTimer=null; }
}
function scheduleReconnect(){
  const delay = nextDelay();
  let left = delay;
  recon.classList.remove("hidden");
  reconSec.textContent = String(left);
  clearTimers();
  reconTimer = setInterval(()=>{
    left--;
    if(left<=0){
      clearTimers();
      recon.classList.add("hidden");
      connect(current, /*forceAlt*/ retryCount>=2);
    } else reconSec.textContent = String(left);
  },1000);
}

/* -----------------------------------
   Connect stream
----------------------------------- */
function connect(channel, forceAlt=false){
  if(!channel) return;
  clearTimers();
  current = channel;
  updateStatusChip("connecting");
  nowPlaying.textContent = `⏳ Connecting: ${channel.label}`;

  // save connecting state
  saveRadioState({
    id: channel.id, label: channel.label, src: channel.src, alt: channel.alt || "",
    connecting: true, playing: false, error: false, mode: "stream", ts: Date.now()
  });

  const src = (forceAlt && channel.alt) ? channel.alt : channel.src;
  try{ player.pause(); player.src = src; player.load(); }catch(e){}
  const playPromise = player.play();
  if(playPromise && typeof playPromise.then==="function"){ playPromise.catch(()=>{}); }

  waitTimer = setTimeout(()=>{
    if(player.readyState < 2){
      try{ player.pause(); player.load(); player.play(); }catch(e){}
    }
  }, 8000);

  settings.lastChannel = channel;
  saveSettings(settings);
}

/* -----------------------------------
   Player events
----------------------------------- */
player.addEventListener("playing", ()=>{
  clearTimers(); recon.classList.add("hidden");
  updateStatusChip(navigator.onLine ? "online" : "offline");
  nowPlaying.textContent = `🎶 Playing: ${current?.label||"—"}`;
  retryCount = 0;

  saveRadioState({
    id: current?.id, label: current?.label, src: current?.src, alt: current?.alt || "",
    connecting: false, playing: true, error: false, mode: "stream", ts: Date.now()
  });
});

player.addEventListener("waiting", ()=>{ updateStatusChip("connecting"); });
player.addEventListener("stalled", ()=>{ updateStatusChip("connecting"); });

player.addEventListener("error", ()=>{
  updateStatusChip("error");
  retryCount++;

  saveRadioState({
    id: current?.id, label: current?.label, src: current?.src, alt: current?.alt || "",
    connecting: false, playing: false, error: true, reason: "stream error",
    mode: "stream", ts: Date.now()
  });

  scheduleReconnect();
});
player.addEventListener("ended", ()=>{
  updateStatusChip("error");
  retryCount++;

  saveRadioState({
    id: current?.id, label: current?.label, src: current?.src, alt: current?.alt || "",
    connecting: false, playing: false, error: true, reason: "stream error",
    mode: "stream", ts: Date.now()
  });

  scheduleReconnect();
});

/* -----------------------------------
   Buttons (channels)
----------------------------------- */
document.querySelectorAll(".channels .btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const ch = {
      id: btn.dataset.id,
      label: btn.textContent,
      src: btn.dataset.src,
      alt: btn.dataset.alt || ""
    };
    retryCount = 0;
    connect(ch,false);
  });
});

/* -----------------------------------
   Manual retry
----------------------------------- */
retryBtn.onclick = ()=>{
  saveRadioState({
    id: current?.id, label: current?.label, src: current?.src, alt: current?.alt || "",
    connecting: true, playing: false, error: false, mode: "stream", ts: Date.now()
  });
  retryCount = 0;
  connect(current,false);
};

/* -----------------------------------
   Calm Loop (offline fallback)
----------------------------------- */
function playLoop(path,label){
  try{
    player.pause();
    player.src = path;
    player.loop = true;
    player.load();
    player.play();
    nowPlaying.textContent = `🕊️ Calm Loop: ${label}`;
    updateStatusChip(navigator.onLine ? "online" : "offline");

    saveRadioState({
      id: "calm", label, src: path, connecting: false, playing: true,
      error: false, mode: "calm", ts: Date.now()
    });
  }catch(e){}
}
$("calmTone").onclick = ()=>playLoop("public/fallback_tone.mp3","Calm Tone");
$("calmMsg").onclick  = ()=>playLoop("public/fallback_message_en.mp3","Calm Message");
$("calmStop").onclick = ()=>{
  try{
    player.pause(); player.loop=false;
    nowPlaying.textContent="Calm Loop stopped.";
    saveRadioState({
      id: "calm", label: "stopped", src: "", connecting: false, playing: false,
      error: false, mode: "calm", ts: Date.now()
    });
  }catch(e){}
};

/* -----------------------------------
   Alerts (Sveriges Radio)
----------------------------------- */
async function loadAlerts(){
  const offlineAlerts=[{time:"—",text:"No active alerts. Stay calm and keep faith."}];
  if(!navigator.onLine){ renderAlerts(offlineAlerts); return; }
  try{
    const res=await fetch("https://api.sr.se/api/v2/alerts?format=json");
    const data=await res.json();
    if(data?.messages?.length){
      const alerts=data.messages.map(m=>({time:m.pubdate,text:m.message}));
      renderAlerts(alerts);
    } else renderAlerts(offlineAlerts);
  }catch{ renderAlerts(offlineAlerts); }
}
function renderAlerts(list){
  alertsBox.innerHTML="";
  list.forEach(a=>{
    const p=document.createElement("p");
    p.textContent=`${a.time}: ${a.text}`;
    alertsBox.appendChild(p);
  });
}
loadAlerts();
setInterval(loadAlerts, 10*60*1000);

/* -----------------------------------
   Restore last channel
----------------------------------- */
if(settings.lastChannel){
  nowPlaying.textContent = `Last channel: ${settings.lastChannel.label} (tap Retry to connect)`;
}

/* -----------------------------------
   End of file
----------------------------------- */
console.log("Radio v3.1 loaded ✅");
