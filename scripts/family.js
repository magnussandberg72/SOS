// ===============================
// SOS Family Module v1.0
// ===============================
const $ = id => document.getElementById(id);
const FAM_KEY="sos.family";

/* ---- Offline banner ---- */
function updateNet(){
  const banner=$("offlineBanner");
  if(navigator.onLine) banner.classList.add("hidden");
  else banner.classList.remove("hidden");
}
window.addEventListener("online",updateNet);
window.addEventListener("offline",updateNet);
updateNet();

/* ---- Load & Save ---- */
function loadFamily(){
  try{return JSON.parse(localStorage.getItem(FAM_KEY)||"{}");}catch{return{};}
}
function saveFamily(d){
  localStorage.setItem(FAM_KEY,JSON.stringify(d));
}
let fam=loadFamily();
if(!fam.members) fam.members=[];
if(!fam.messages) fam.messages=[];
if(!fam.prayers) fam.prayers=[];
renderMembers();renderMessages();renderPrayers();

/* ---- Members ---- */
function renderMembers(){
  const list=$("membersList");
  list.innerHTML="";
  if(fam.members.length===0){
    list.innerHTML="<p>No family members added yet.</p>";
    return;
  }
  fam.members.forEach((m,i)=>{
    const div=document.createElement("div");
    div.innerHTML=`<strong>${m.name}</strong> – ${m.location||"Unknown"} 
      <span style="color:${m.safe?'#6f6':'#f77'}">[${m.safe?'Safe':'Unknown'}]</span>`;
    div.onclick=()=>{
      m.safe=!m.safe;
      m.lastSeen=new Date().toISOString();
      saveFamily(fam);renderMembers();
    };
    list.appendChild(div);
  });
}
$("addMember").onclick=()=>{
  const name=$("memberName").value.trim();
  const loc=$("memberLocation").value.trim();
  if(!name) return alert("Enter name");
  fam.members.push({name,location:loc,safe:false,lastSeen:new Date().toISOString()});
  saveFamily(fam);
  $("memberName").value=$("memberLocation").value="";
  renderMembers();
};

/* ---- Messages ---- */
function renderMessages(){
  const box=$("familyChat");
  box.innerHTML="";
  if(fam.messages.length===0){box.innerHTML="<p>No messages yet.</p>";return;}
  fam.messages.slice().reverse().forEach(m=>{
    const d=document.createElement("div");
    const time=new Date(m.timestamp).toLocaleTimeString();
    d.textContent=`${time} ${m.from||"—"}: ${m.text}`;
    box.appendChild(d);
  });
}
$("sendMsg").onclick=()=>{
  const text=$("msgInput").value.trim();
  if(!text)return;
  fam.messages.push({text,from:"You",timestamp:new Date().toISOString()});
  saveFamily(fam);
  $("msgInput").value="";
  renderMessages();
};

/* ---- Prayers ---- */
function renderPrayers(){
  const ul=$("prayerList");
  ul.innerHTML="";
  if(fam.prayers.length===0){ul.innerHTML="<li>No prayers added yet.</li>";return;}
  fam.prayers.slice().reverse().forEach(p=>{
    const li=document.createElement("li");
    li.textContent=p;
    ul.appendChild(li);
  });
}
$("addPrayer").onclick=()=>{
  const txt=$("prayerInput").value.trim();
  if(!txt)return;
  fam.prayers.push(txt);
  saveFamily(fam);
  $("prayerInput").value="";
  renderPrayers();
};

/* ---- Kids: Play Comfort Story ---- */
$("playStory").onclick=()=>{
  const audio=new Audio("public/fallback_message_en.mp3");
  audio.play();
  alert("Playing comfort story (local file)");
};

console.log("Family module loaded ✅");
