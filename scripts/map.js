// =======================================
// SOS Shelter Map v1.0 (offline tiles)
// Pan/zoom, markers, export/import, Health sync
// =======================================
const $ = id => document.getElementById(id);

/* ---------- Storage keys ---------- */
const MAP_KEY = "sos.map";
const HEALTH_META = "sos.health.meta"; // { shelterId, lastUpdate }

/* ---------- State ---------- */
let mapState = loadMapState() || {
  view: { z: 5, lat: 65.75, lon: 23.0 }, // Norrbotten-ish default
  userShelter: null, // { id, coords:[lat,lon], people? }
  markers: []        // [{id, coords:[lat,lon], note, mine:false}]
};

/* ---------- Elements ---------- */
const netChip = $("netChip");
const offlineBanner = $("offlineBanner");
const centerInfo = $("centerInfo");
const shelterId = $("shelterId");
const saveShelterIdBtn = $("saveShelterId");
const markAsMineBtn = $("markAsMine");
const latIn = $("latIn");
const lonIn = $("lonIn");
const noteIn = $("noteIn");
const addMarkerBtn = $("addMarker");
const clearMarkersBtn = $("clearMarkers");
const mapEl = $("map");
const markerList = $("markerList");

/* ---------- Net status ---------- */
function updateNet(){
  if(navigator.onLine){
    netChip.textContent="Online"; netChip.className="chip online";
    offlineBanner.classList.add("hidden");
  }else{
    netChip.textContent="Offline"; netChip.className="chip offline";
    offlineBanner.classList.remove("hidden");
  }
}
window.addEventListener("online",updateNet);
window.addEventListener("offline",updateNet);
updateNet();

/* ---------- Health meta sync ---------- */
function loadHealthMeta(){
  try { return JSON.parse(localStorage.getItem(HEALTH_META)||"{}"); } catch { return {}; }
}
function saveHealthMeta(m){
  localStorage.setItem(HEALTH_META, JSON.stringify(m));
}
let hmeta = loadHealthMeta();
shelterId.value = hmeta.shelterId || "";

/* ---------- Helpers: Web Mercator ---------- */
const TILE = 256;
function lon2x(lon){ return (lon + 180) / 360; }
function lat2y(lat){
  const s = Math.sin(lat * Math.PI/180);
  return (0.5 - Math.log((1+s)/(1-s)) / (4*Math.PI));
}
function x2lon(x){ return x*360 - 180; }
function y2lat(y){ const n = Math.PI - 2*Math.PI*y; return (180/Math.PI)*Math.atan(0.5*(Math.exp(n)-Math.exp(-n))); }

/* Convert lat/lon to pixel coords at zoom z */
function latLonToPx(lat, lon, z){
  const scale = TILE * Math.pow(2,z);
  return {
    x: lon2x(lon) * scale,
    y: lat2y(lat) * scale
  };
}
function pxToLatLon(x,y,z){
  const scale = TILE * Math.pow(2,z);
  return {
    lat: y2lat(y/scale),
    lon: x2lon(x/scale)
  };
}

/* ---------- Map view/pan/zoom ---------- */
let isDragging=false, dragStart=null, centerPx=null;

function updateCenterInfo(){
  const {lat,lon,z} = mapState.view;
  centerInfo.textContent = `Center: ${lat.toFixed(5)}, ${lon.toFixed(5)} | z${z}`;
}

function renderMap(){
  // Clear tiles & dots
  mapEl.innerHTML = "";
  // center px at zoom
  const {lat,lon,z} = mapState.view;
  const center = latLonToPx(lat,lon,z);
  const w = mapEl.clientWidth, h = mapEl.clientHeight;
  const leftPx = center.x - w/2;
  const topPx  = center.y - h/2;

  // Tile range
  const startX = Math.floor(leftPx / TILE);
  const startY = Math.floor(topPx  / TILE);
  const endX   = Math.floor((leftPx + w) / TILE);
  const endY   = Math.floor((topPx  + h) / TILE);

  for(let tx=startX; tx<=endX; tx++){
    for(let ty=startY; ty<=endY; ty++){
      const img = document.createElement("img");
      img.className = "tile";
      const zpow = Math.pow(2,z);
      // wrap X for world repetition
      let x = ((tx % zpow) + zpow) % zpow;
      let y = ty;
      if(y<0 || y>=zpow){
        // outside mercator y-range: draw empty
        img.style.opacity = 0.08;
      }else{
        img.src = `public/tiles/${z}/${x}/${y}.png`;
        img.onerror = ()=>{ img.style.opacity=0.08; };
      }
      img.style.left = (tx*TILE - leftPx) + "px";
      img.style.top  = (ty*TILE - topPx) + "px";
      mapEl.appendChild(img);
    }
  }

  // Dots (markers)
  (mapState.markers||[]).forEach(m=>{
    const p = latLonToPx(m.coords[0], m.coords[1], z);
    const dot = document.createElement("div");
    dot.className = "dot"+(m.mine?" mine":"");
    dot.title = (m.mine ? "[My shelter] " : "") + (m.id||"") + (m.note?(" – "+m.note):"");
    dot.style.left = (p.x - leftPx) + "px";
    dot.style.top  = (p.y - topPx) + "px";
    mapEl.appendChild(dot);
  });

  updateCenterInfo();
}

function setCenter(lat,lon){ mapState.view.lat=lat; mapState.view.lon=lon; saveMapState(); renderMap(); }
function setZoom(z){
  mapState.view.z = Math.max(2, Math.min(18, z));
  saveMapState(); renderMap();
}

/* Drag pan */
mapEl.addEventListener("mousedown", e=>{
  isDragging=true; mapEl.classList.add("dragging");
  dragStart = { x:e.clientX, y:e.clientY };
  const {lat,lon,z} = mapState.view;
  centerPx = latLonToPx(lat,lon,z);
});
window.addEventListener("mousemove", e=>{
  if(!isDragging) return;
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  const {z} = mapState.view;
  const newX = centerPx.x - dx;
  const newY = centerPx.y - dy;
  const ll = pxToLatLon(newX,newY,z);
  mapState.view.lat = ll.lat;
  mapState.view.lon = ll.lon;
  renderMap();
});
window.addEventListener("mouseup", ()=>{
  if(isDragging){ isDragging=false; mapEl.classList.remove("dragging"); saveMapState(); }
});

/* Wheel zoom centered */
mapEl.addEventListener("wheel", e=>{
  e.preventDefault();
  const delta = Math.sign(e.deltaY);
  setZoom(mapState.view.z - delta);
}, {passive:false});

/* Click to add marker at click position (with note) */
mapEl.addEventListener("click", e=>{
  if(isDragging) return; // ignore click after drag
  const rect = mapEl.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  const {lat,lon,z} = mapState.view;
  const center = latLonToPx(lat,lon,z);
  const leftPx = center.x - mapEl.clientWidth/2;
  const topPx  = center.y - mapEl.clientHeight/2;
  const worldX = leftPx + px;
  const worldY = topPx + py;
  const ll = pxToLatLon(worldX, worldY, z);

  const note = noteIn.value.trim();
  const id = shelterId.value.trim() || "";
  mapState.markers.push({ id, coords:[ll.lat, ll.lon], note, mine:false });
  saveMapState();
  renderMap();
  renderMarkerList();
});

/* ---------- Buttons ---------- */
$("zoomIn").onclick = ()=> setZoom(mapState.view.z+1);
$("zoomOut").onclick = ()=> setZoom(mapState.view.z-1);
$("panUp").onclick = ()=> nudge(0,-100);
$("panDown").onclick = ()=> nudge(0,100);
$("panLeft").onclick = ()=> nudge(-150,0);
$("panRight").onclick = ()=> nudge(150,0);

function nudge(dx,dy){
  const {lat,lon,z} = mapState.view;
  const c = latLonToPx(lat,lon,z);
  const ll = pxToLatLon(c.x+dx, c.y+dy, z);
  setCenter(ll.lat, ll.lon);
}

/* Go to / GPS */
$("goTo").onclick = ()=>{
  const lat = Number(latIn.value); const lon = Number(lonIn.value);
  if(Number.isFinite(lat) && Number.isFinite(lon)) setCenter(lat,lon);
  else alert("Enter valid lat/lon");
};
$("geo").onclick = ()=>{
  if(!navigator.geolocation){ alert("Geolocation not supported."); return; }
  navigator.geolocation.getCurrentPosition(pos=>{
    const {latitude,longitude} = pos.coords;
    setCenter(latitude,longitude);
    latIn.value = latitude.toFixed(6);
    lonIn.value = longitude.toFixed(6);
  },()=>alert("Could not get GPS."));
};

/* Health sync */
saveShelterIdBtn.onclick = ()=>{
  hmeta = loadHealthMeta();
  hmeta.shelterId = shelterId.value.trim();
  hmeta.lastUpdate = new Date().toLocaleString();
  saveHealthMeta(hmeta);
  alert("Shelter ID saved.");
};
markAsMineBtn.onclick = ()=>{
  const id = shelterId.value.trim() || "(unnamed shelter)";
  mapState.userShelter = { id, coords:[mapState.view.lat, mapState.view.lon] };
  // mark nearest marker as mine or create one
  let nearestIdx = -1, best=1e9;
  mapState.markers.forEach((m,i)=>{
    const d = dist(m.coords, mapState.userShelter.coords);
    if(d<best){best=d; nearestIdx=i;}
  });
  if(nearestIdx>=0 && best < 0.005){ // ~0.5km rough
    mapState.markers[nearestIdx].mine = true;
    mapState.markers[nearestIdx].id = id || mapState.markers[nearestIdx].id;
  }else{
    mapState.markers.push({ id, coords:[...mapState.userShelter.coords], note:"My shelter", mine:true });
  }
  saveMapState();
  renderMap(); renderMarkerList();
};

/* Add/Clear markers via form */
addMarkerBtn.onclick = ()=>{
  const note = noteIn.value.trim();
  const id = shelterId.value.trim() || "";
  const lat = Number(latIn.value), lon = Number(lonIn.value);
  if(!Number.isFinite(lat) || !Number.isFinite(lon)){ alert("Enter valid lat/lon to add marker."); return; }
  mapState.markers.push({ id, coords:[lat,lon], note, mine:false });
  saveMapState(); renderMap(); renderMarkerList();
};
clearMarkersBtn.onclick = ()=>{
  if(!confirm("Clear ALL markers?")) return;
  mapState.markers = [];
  saveMapState(); renderMap(); renderMarkerList();
};

/* ---------- Marker list ---------- */
function renderMarkerList(){
  markerList.innerHTML = "";
  if(!mapState.markers.length){ markerList.innerHTML="<p class='muted'>No markers yet. Click the map to add one.</p>"; return; }
  mapState.markers.forEach((m,idx)=>{
    const row = document.createElement("div");
    row.className = "row";
    const tag = `<span class="tag${m.mine?' mine':''}">${m.mine?'My shelter':'Shelter'}</span>`;
    row.innerHTML = `
      <div>${tag} ${escapeHtml(m.id||"—")}</div>
      <div>${m.coords[0].toFixed(5)}, ${m.coords[1].toFixed(5)}</div>
      <div>${escapeHtml(m.note||"")}</div>
      <div><button class="del" data-i="${idx}">Delete</button></div>
    `;
    row.querySelector(".del").onclick = (e)=>{
      const i = Number(e.currentTarget.dataset.i);
      mapState.markers.splice(i,1);
      saveMapState(); renderMap(); renderMarkerList();
    };
    markerList.appendChild(row);
  });
}

/* ---------- Export / Import ---------- */
$("exportBtn").onclick = ()=>{
  const data = JSON.stringify(mapState, null, 2);
  const blob = new Blob([data], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download="sos_map_export.json"; a.click();
  URL.revokeObjectURL(url);
};
$("importFile").addEventListener("change", async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  try{
    const text = await file.text();
    const obj = JSON.parse(text);
    if(!obj.view || !obj.markers){ alert("Invalid JSON."); return; }
    mapState = obj;
    saveMapState();
    latIn.value = mapState.view.lat.toFixed(6);
    lonIn.value = mapState.view.lon.toFixed(6);
    renderMap(); renderMarkerList();
    alert("Imported map data.");
  }catch(err){ alert("Failed to import."); }
});

/* ---------- Storage ---------- */
function loadMapState(){
  try{ return JSON.parse(localStorage.getItem(MAP_KEY)||""); }catch{ return null; }
}
function saveMapState(){
  localStorage.setItem(MAP_KEY, JSON.stringify(mapState));
}

/* ---------- Utils ---------- */
function escapeHtml(s=""){ return s.replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function dist(a,b){ // rough lat/lon distance (deg)
  const dx=a[0]-b[0], dy=a[1]-b[1];
  return Math.sqrt(dx*dx+dy*dy);
}

/* ---------- Init ---------- */
function boot(){
  // center inputs
  latIn.value = mapState.view.lat.toFixed(6);
  lonIn.value = mapState.view.lon.toFixed(6);
  renderMap();
  renderMarkerList();
  // Resize re-render
  window.addEventListener("resize", renderMap);
}
boot();
console.log("Shelter Map loaded ✅");
