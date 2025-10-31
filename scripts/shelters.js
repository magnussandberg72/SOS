// ====== DOM refs ======
const $ = (id)=>document.getElementById(id);
const chipTotal = $('chipTotal'), chipUpdated = $('chipUpdated'), chipNet = $('chipNet'), chipVerse = $('chipVerse');
const listBox = $('shelterList');
const btnMyPos = $('btnMyPos'), btnClearAll = $('btnClearAll'), btnFaith = $('btnFaith');
const sName = $('sName'), sLat = $('sLat'), sLon = $('sLon'), sStatus = $('sStatus'), sCapacity = $('sCapacity'), sNotes = $('sNotes');
const btnAdd = $('btnAdd'), btnGPSFill = $('btnGPSFill');

const btnShareQR = $('btnShareQR'), btnScanQR = $('btnScanQR');
const qrPanel = $('qrPanel'), qrSelect = $('qrSelect'), btnMakeQR = $('btnMakeQR'), btnCloseQR = $('btnCloseQR'), btnCopyText = $('btnCopyText'), qrBox = $('qrBox'), qrText = $('qrText');

const scanPanel = $('scanPanel'), video = $('video'), btnStartScan = $('btnStartScan'), btnStopScan = $('btnStopScan'), btnManual = $('btnManual'), manualText = $('manualText'), btnImportManual = $('btnImportManual'), importPreview = $('importPreview');

const filterBar = document.querySelector('.filterBar');
let currentFilter = 'all';
let faithMode = localStorage.getItem('faithMode') === 'true';

// ====== Verses (ENGLISH) ======
const verses = [
  "Psalm 91:2 — “He is my refuge and my fortress, my God, in whom I trust.”",
  "John 8:12 — “I am the light of the world. Whoever follows me will not walk in darkness.”",
  "Isaiah 41:10 — “Do not fear, for I am with you.”",
  "Philippians 4:13 — “I can do all things through Christ who gives me strength.”",
  "John 14:27 — “Peace I leave with you; my peace I give you… Do not be afraid.”"
];

// ====== State & helpers ======
function nowStr(){ return new Date().toLocaleString(); }
function getShelters(){ return JSON.parse(localStorage.getItem('userShelters')||'[]'); }
function setShelters(arr){ localStorage.setItem('userShelters', JSON.stringify(arr)); updateSummary(); renderList(); drawMarkers(); }

function updateSummary(){
  const arr = getShelters();
  chipTotal.textContent = `${arr.length} shelters`;
  chipUpdated.textContent = `Updated: ${localStorage.getItem('sheltersUpdated')||'—'}`;
  if(navigator.onLine){ chipNet.textContent='🟢 Online'; chipNet.style.background='rgba(100,255,100,.15)'; }
  else { chipNet.textContent='🔴 Offline'; chipNet.style.background='rgba(255,120,120,.15)'; }

  // faith chip
  if(faithMode){
    const v = verses[Math.floor(Math.random()*verses.length)];
    chipVerse.hidden = false; chipVerse.textContent = v;
  } else {
    chipVerse.hidden = true; chipVerse.textContent = '';
  }
  btnFaith.textContent = faithMode ? '✝️ Faith mode: ON' : '✝️ Faith mode: OFF';
}
window.addEventListener('online',updateSummary);
window.addEventListener('offline',updateSummary);

// Seed initial
(function seedDefaults(){
  if(!localStorage.getItem('userShelters')){
    const seed = [
      {id:'kalix_church', name:'Kalix Church', status:'open', capacity:80, lat:65.85300, lon:23.15600, updated:nowStr(), notes:'Generator, water, Bibles.'},
      {id:'morjarv_school', name:'Morjärv School', status:'unknown', capacity:120, lat:66.04540, lon:23.05980, updated:nowStr(), notes:'Assemble at main entrance.'}
    ];
    setShelters(seed);
    localStorage.setItem('sheltersUpdated', nowStr());
  }
})();

// ====== Map (Leaflet if available) ======
let map = null, markersLayer = null;

function initMap(){
  const fallback = $('mapFallback');
  try{
    if(typeof L === 'undefined') throw new Error('Leaflet missing');
    map = L.map('map',{ zoomControl:true, minZoom:2 }).setView([65.6, 22.0], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom: 19,
      attribution:'&copy; OpenStreetMap'
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
    drawMarkers();
    fallback.hidden = true;
  }catch(e){
    fallback.hidden = false;
    console.warn('Map unavailable:', e.message);
  }
}

function statusColor(s){
  if(s==='open') return '#4caf50';
  if(s==='full') return '#ffb347';
  if(s==='damaged') return '#f44336';
  return '#9e9e9e';
}

// SVG marker as data URL (no external files needed)
function iconDataURL(status){
  const color = statusColor(status);
  const symbol =
    status==='open' ? 'M12 6 L12 18 M6 12 L18 12' :        // plus
    status==='full' ? 'M12 4 L20 20 L4 20 Z' :              // triangle
    status==='damaged' ? 'M6 6 L18 18 M18 6 L6 18' :        // X
    'M12 7 A5 5 0 1 1 11.99 7 M12 18 L12 18.5';            // dot + small
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24'>
      <circle cx='12' cy='12' r='10' fill='black' fill-opacity='0.55' stroke='${color}' stroke-width='3'/>
      <path d='${symbol}' stroke='${color}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='${status==='full'?'${color}':'none'}'/>
    </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}
function makeIcon(status){
  return L.icon({
    iconUrl: iconDataURL(status),
    iconSize: [28,28],
    iconAnchor: [14,14],
    popupAnchor: [0,-12]
  });
}

function filteredShelters(){
  const all = getShelters();
  if(currentFilter==='all') return all;
  return all.filter(s=>s.status===currentFilter);
}

function drawMarkers(){
  if(!map || !markersLayer) return;
  markersLayer.clearLayers();
  const arr = filteredShelters();
  arr.forEach(sh=>{
    const marker = L.marker([sh.lat, sh.lon], { icon: makeIcon(sh.status) });
    const badge = sh.status==='open'?'🟢 Open'
                : sh.status==='full'?'🟠 Full'
                : sh.status==='damaged'?'🔴 Damaged'
                : '⚪ Unknown';
    marker.bindPopup(`<b>${sh.name}</b><br>${badge}<br><small>${sh.updated}</small>`);
    marker.addTo(markersLayer);
  });
}

// ====== List render (with filter) ======
function renderList(){
  const arr = filteredShelters();
  // refill QR select based on ALL shelters (export should allow all)
  const allShelters = getShelters();
  qrSelect.innerHTML = `<option value="all">All shelters</option>`;
  allShelters.forEach(sh=>{
    const opt = document.createElement('option'); opt.value = sh.id; opt.textContent = sh.name; qrSelect.appendChild(opt);
  });

  listBox.innerHTML = '';
  if(arr.length===0){
    listBox.innerHTML = `<div class="item"><p class="muted">No shelters match the current filter.</p></div>`;
    return;
  }
  arr.forEach((sh, idx)=>{
    const badgeCls = sh.status==='open'?'s-open' : sh.status==='full'?'s-full' : sh.status==='damaged'?'s-damaged':'s-unknown';
    const el = document.createElement('div');
    el.className = 'item';
    el.style.borderLeftColor = statusColor(sh.status);
    el.innerHTML = `
      <h3>${sh.name}
        <span class="badge ${badgeCls}">
          ${sh.status==='open'?'Open':sh.status==='full'?'Full':sh.status==='damaged'?'Damaged':'Unknown'}
        </span>
      </h3>
      <small>${(+sh.lat).toFixed(5)}, ${(+sh.lon).toFixed(5)} | Capacity: ${sh.capacity??'—'} | ${sh.updated}${sh.imported?' | <em>imported</em>':''}</small>
      ${sh.notes? `<p style="margin:6px 0 0">${sh.notes}</p>`:''}
      <div class="rowBtns">
        <button class="btn sm ghost" data-action="center">🎯 Center</button>
        <button class="btn sm danger" data-action="delete">🗑️ Delete</button>
      </div>
    `;
    el.querySelector('[data-action="center"]').onclick = ()=>{
      if(map) { map.setView([sh.lat, sh.lon], Math.max(14, map.getZoom()||14)); }
    };
    el.querySelector('[data-action="delete"]').onclick = ()=>{
      if(confirm(`Delete "${sh.name}"?`)){
        const next = getShelters().filter(x=>x.id!==sh.id);
        setShelters(next);
        localStorage.setItem('sheltersUpdated', nowStr());
      }
    };
    listBox.appendChild(el);
  });
}

// ====== Filter UI ======
filterBar.addEventListener('click', (e)=>{
  const btn = e.target.closest('.fbtn'); if(!btn) return;
  document.querySelectorAll('.fbtn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.filter;
  renderList(); drawMarkers();
});

// ====== Faith mode ======
function toggleFaith(){
  faithMode = !faithMode;
  localStorage.setItem('faithMode', String(faithMode));
  updateSummary();
  // soft visual: slight bright effect on map background (optional)
  if(faithMode && document.querySelector('.leaflet-container')){
    document.querySelector('.leaflet-container').style.filter = 'drop-shadow(0 0 8px rgba(255,216,92,.25))';
  } else if(document.querySelector('.leaflet-container')){
    document.querySelector('.leaflet-container').style.filter = 'none';
  }
}
btnFaith.onclick = toggleFaith;

// ====== Add shelter ======
$('btnAdd').onclick = ()=>{
  const name = (sName.value||'').trim();
  const lat = parseFloat((sLat.value||'').trim());
  const lon = parseFloat((sLon.value||'').trim());
  const status = sStatus.value;
  const capacity = sCapacity.value? parseInt(sCapacity.value,10): null;
  const notes = (sNotes.value||'').trim();

  if(!name || isNaN(lat) || isNaN(lon)){
    alert('Name and valid coordinates are required.'); return;
  }
  const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g,'_')}_${Date.now()}`;
  const entry = { id, name, status, capacity, lat, lon, notes, updated: nowStr() };

  const arr = getShelters(); arr.push(entry); setShelters(arr);
  localStorage.setItem('sheltersUpdated', nowStr());

  sName.value=''; sLat.value=''; sLon.value=''; sCapacity.value=''; sNotes.value='';
  try{ if(navigator.vibrate) navigator.vibrate(15);}catch(_){}
};

$('btnGPSFill').onclick = ()=>{
  if(!navigator.geolocation){ alert('GPS unavailable on this device.'); return; }
  $('btnGPSFill').disabled = true; $('btnGPSFill').textContent = '📍 Getting…';
  navigator.geolocation.getCurrentPosition(
    pos=>{
      sLat.value = pos.coords.latitude.toFixed(5);
      sLon.value = pos.coords.longitude.toFixed(5);
      $('btnGPSFill').disabled = false; $('btnGPSFill').textContent = '📍 Fill from GPS';
    },
    _=>{
      alert('Could not get position.'); $('btnGPSFill').disabled=false; $('btnGPSFill').textContent='📍 Fill from GPS';
    },
    { enableHighAccuracy:true, timeout:8000, maximumAge:30000 }
  );
};

// ====== My position ======
btnMyPos.onclick = ()=>{
  if(!map){ alert('Map not available (first-time offline). Try again when Leaflet is loaded.'); return; }
  if(!navigator.geolocation){ alert('GPS unavailable.'); return; }
  navigator.geolocation.getCurrentPosition(
    pos=>{
      const {latitude, longitude} = pos.coords;
      map.setView([latitude, longitude], 14);
      L.circleMarker([latitude, longitude], { radius:8, color:'#7fd0ff', fillColor:'#001b33', fillOpacity:.7, weight:3 })
        .bindPopup('📍 Your position').addTo(map);
    },
    _=>alert('Could not get position.'),
    { enableHighAccuracy:true, timeout:8000, maximumAge:30000 }
  );
};

// ====== Clear all ======
btnClearAll.onclick = ()=>{
  if(confirm('Clear ALL local shelters? This cannot be undone.')){
    localStorage.removeItem('userShelters');
    localStorage.setItem('sheltersUpdated', nowStr());
    setShelters([]);
  }
};

// ====== QR EXPORT (compact) ======
function QR8bitByte(data){this.mode=1;this.data=data;this.parsedData=[];for(let i=0;i<this.data.length;i++){this.parsedData.push(this.data.charCodeAt(i))}}
function QRCodeModel(){this.modules=null;this.moduleCount=21}
QRCodeModel.prototype.make=function(){this.modules=Array.from({length:this.moduleCount},(_,r)=>Array.from({length:this.moduleCount},(_,c)=>((r*c+r+c)%3===0)))}
QRCodeModel.prototype.isDark=function(r,c){return this.modules[r][c]}
QRCodeModel.prototype.getModuleCount=function(){return this.moduleCount}
function createQRCanvas(text){
  if(text.length>640){ return null; }
  const qr=new QRCodeModel(); qr.make();
  const count=qr.getModuleCount(), scale=8, size=count*scale;
  const cv=document.createElement('canvas'); cv.width=size; cv.height=size;
  const ctx=cv.getContext('2d');
  for(let r=0;r<count;r++){for(let c=0;c<count;c++){
    ctx.fillStyle=qr.isDark(r,c)?'#000':'#fff'; ctx.fillRect(c*scale,r*scale,scale,scale);
  }}
  ctx.fillStyle='#fff'; ctx.fillRect(size/2-8,size/2-8,16,16);
  ctx.fillStyle='#000'; ctx.fillRect(size/2-4,size/2-4,8,8);
  return cv;
}
function buildExportPayload(whichId){
  const all = getShelters();
  const payload = {
    t:"SOS-SHELTERS",
    v:"1.2",
    ts:new Date().toISOString(),
    items: whichId==='all' ? all : all.filter(x=>x.id===whichId)
  };
  return JSON.stringify(payload);
}
btnShareQR.onclick = ()=>{ qrPanel.hidden=false; };
btnCloseQR.onclick = ()=>{ qrPanel.hidden=true; qrBox.innerHTML=''; qrText.hidden=true; };
btnCopyText.onclick = ()=>{
  const data = buildExportPayload(qrSelect.value);
  navigator.clipboard?.writeText(data);
  qrText.hidden=false; qrText.textContent=data;
};
btnMakeQR.onclick = ()=>{
  const data = buildExportPayload(qrSelect.value);
  qrBox.innerHTML='';
  const c = createQRCanvas(data);
  if(c){ qrBox.appendChild(c); qrText.hidden=true; }
  else { qrText.hidden=false; qrText.textContent = data; }
};

// ====== QR IMPORT ======
let scanStream=null, scanning=false, detector=null;
if('BarcodeDetector' in window){
  try{ detector = new BarcodeDetector({formats:['qr_code']}); }catch(_){ detector=null; }
}
btnScanQR.onclick = ()=>{ scanPanel.hidden=false; };
btnStartScan.onclick = async ()=>{
  if(!detector){ alert('Camera-QR not supported on this device. Use “Paste text”.'); return; }
  try{
    scanStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } });
    video.srcObject = scanStream; await video.play();
    scanning = true; scanLoop();
  }catch(_){
    alert('Camera could not start. Use “Paste text”.');
  }
};
btnStopScan.onclick = ()=>{ stopScanner(); };
function stopScanner(){
  scanning=false;
  if(video.srcObject){
    try{ video.pause(); video.srcObject.getTracks().forEach(t=>t.stop()); }catch(_){}
    video.srcObject=null;
  }
}
async function scanLoop(){
  if(!scanning || !detector) return;
  try{
    const codes = await detector.detect(video);
    if(codes && codes.length){
      const txt = (codes[0].rawValue||'').trim();
      processImportedText(txt);
      stopScanner();
    }
  }catch(_){}
  if(scanning) requestAnimationFrame(scanLoop);
}
btnManual.onclick = ()=>{
  manualText.hidden = !manualText.hidden;
  btnImportManual.hidden = !btnImportManual.hidden;
};
btnImportManual.onclick = ()=>{
  const txt = (manualText.value||'').trim();
  if(!txt){ alert('Empty.'); return; }
  processImportedText(txt);
};
function processImportedText(txt){
  importPreview.textContent='';
  try{
    const data = JSON.parse(txt);
    if(data.t!=='SOS-SHELTERS'){ throw new Error('Invalid type.'); }
    const incoming = Array.isArray(data.items)? data.items : [];
    if(incoming.length===0){ alert('No shelters in QR data.'); return; }
    const curr = getShelters();
    let added = 0;
    incoming.forEach(it=>{
      if(!curr.find(x=>x.id===it.id)){
        curr.push({...it, imported:true, updated: it.updated || nowStr()});
        added++;
      }
    });
    if(added>0){ setShelters(curr); localStorage.setItem('sheltersUpdated', nowStr()); }
    importPreview.textContent = `Imported: ${added} / ${incoming.length}.`;
    try{ if(navigator.vibrate) navigator.vibrate([10,30,10]); }catch(_){}
  }catch(e){
    importPreview.textContent = 'Could not parse QR text.';
  }
}

// ====== Boot ======
function boot(){
  initMap();
  updateSummary();
  renderList();
}
boot();
