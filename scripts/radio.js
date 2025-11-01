// SOS Radio v1.0
const $ = id => document.getElementById(id);
const player = $("radioPlayer");
const statusEl = $("status");
const nowPlaying = $("nowPlaying");
const alertsBox = $("alertsBox");

// Status
function updateStatus(){
  if(navigator.onLine){
    statusEl.textContent="Online";
    statusEl.className="status online";
  } else {
    statusEl.textContent="Offline";
    statusEl.className="status offline";
  }
}
window.addEventListener("online",updateStatus);
window.addEventListener("offline",updateStatus);
updateStatus();

// Channel switch
document.querySelectorAll(".channels .btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const src=btn.dataset.src;
    player.src=src;
    player.play();
    nowPlaying.textContent="🎶 Playing: "+btn.textContent;
  });
});

// Emergency alerts (simple local + optional fetch)
async function loadAlerts(){
  const offlineAlerts = [
    { time:"—", text:"No active alerts. Stay calm and keep faith." }
  ];
  if(!navigator.onLine){
    renderAlerts(offlineAlerts);
    return;
  }

  try{
    const res = await fetch("https://api.sr.se/api/v2/alerts?format=json");
    const data = await res.json();
    if(data?.messages?.length){
      const alerts = data.messages.map(m=>({
        time:m.pubdate,
        text:m.message
      }));
      renderAlerts(alerts);
    } else renderAlerts(offlineAlerts);
  }catch{
    renderAlerts(offlineAlerts);
  }
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
setInterval(loadAlerts, 10*60*1000); // every 10 min
