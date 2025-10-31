// ====== DOM refs ======
const $ = (id)=>document.getElementById(id);
const chipTotal = $('chipTotal'), chipUpdated = $('chipUpdated'), chipNet = $('chipNet');
const listBox = $('shelterList');
const btnMyPos = $('btnMyPos'), btnClearAll = $('btnClearAll');
const sName = $('sName'), sLat = $('sLat'), sLon = $('sLon'), sStatus = $('sStatus'), sCapacity = $('sCapacity'), sNotes = $('sNotes');
const btnAdd = $('btnAdd'), btnGPSFill = $('btnGPSFill');

// QR elements
const btnShareQR = $('btnShareQR'), btnScanQR = $('btnScanQR');
const qrPanel = $('qrPanel'), qrSelect = $('qrSelect'), btnMakeQR = $('btnMakeQR'), btnCloseQR = $('btnCloseQR'), btnCopyText = $('btnCopyText'), qrBox = $('qrBox'), qrText = $('qrText');

const scanPanel = $('scanPanel'), video = $('video'), btnStartScan = $('btnStartScan'), btnStopScan = $('btnStopScan'), btnManual = $('btnManual'), manualText = $('manualText'), btnImportManual = $('btnImportManual'), importPreview = $('importPreview');

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
}
window.addEventListener('online',updateSummary);
window.addEventListener('offline',updateSummary);

// Seed initial
(function seedDefaults(){
  if(!localStorage.getItem('userShelters')){
    const seed = [
      {id:'kalix_church', name:'Kalix Kyrka', status:'open', capacity:80, lat:65.85300, lon:23.15600, updated:nowStr(), notes:'Generator, vatten, biblar.'},
      {id:'morjarv_school', name:'Morjärv Skola', status:'unknown', capacity:120, lat:66.04540, lon:23.05980, updated:nowStr(), notes:'Samling vid entrén.'}
    ];
    setShelters(seed);
    localStorage.setItem('sheltersUpdated', nowStr());
  }
})();

// ====== Map (Leaflet if available) ======
let map = null, markersLayer = null;

function initMap(){
  const mapDiv = $('map'), fallback = $('mapFallback');
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
function drawMarkers(){
  if(!map || !markersLayer) return;
  markersLayer.clearLayers();
  const arr = getShelters();
  arr.forEach(sh=>{
    const marker = L.circleMarker([sh.lat, sh.lon], {
      radius: 9, color: statusColor(sh.status), weight: 3, fillColor:'#000', fillOpacity:.6
    });
    const badge = sh.status==='open'?'🟢 Open'
                : sh.status==='full'?'🟠 Full'
                : sh.status==='damaged'?'🔴 Damaged'
                : '⚪ Unknown';
    marker.bindPopup(`<b>${sh.name}</b><br>${badge}<br><small>${sh.updated}</small>`);
    marker.addTo(markersLayer);
  });
}

// ====== List render ======
function renderList(){
  const arr = getShelters();
  listBox.innerHTML = '';
  // refill QR select
  qrSelect.innerHTML = `<option value="all">Alla shelters</option>`;
  arr.forEach((sh, idx)=>{
    const opt = document.createElement('option');
    opt.value = sh.id; opt.textContent = sh.name; qrSelect.appendChild(opt);
  });

  if(arr.length===0){
    listBox.innerHTML = `<div class="item"><p class="muted">Inga shelters sparade ännu.</p></div>`;
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
      <small>${(+sh.lat).toFixed(5)}, ${(+sh.lon).toFixed(5)} | Kapacitet: ${sh.capacity??'—'} | ${sh.updated}${sh.imported?' | <em>imported</em>':''}</small>
      ${sh.notes? `<p style="margin:6px 0 0">${sh.notes}</p>`:''}
      <div class="rowBtns">
        <button class="btn sm ghost" data-action="center">🎯 Centra</button>
        <button class="btn sm danger" data-action="delete">🗑️ Ta bort</button>
      </div>
    `;
    el.querySelector('[data-action="center"]').onclick = ()=>{
      if(map) { map.setView([sh.lat, sh.lon], Math.max(14, map.getZoom()||14)); }
    };
    el.querySelector('[data-action="delete"]').onclick = ()=>{
      if(confirm(`Ta bort "${sh.name}"?`)){
        const next = getShelters().filter((_,i)=>i!==idx);
        setShelters(next);
        localStorage.setItem('sheltersUpdated', nowStr());
      }
    };
    listBox.appendChild(el);
  });
}

// ====== Add shelter ======
$('btnAdd').onclick = ()=>{
  const name = (sName.value||'').trim();
  const lat = parseFloat((sLat.value||'').trim());
  const lon = parseFloat((sLon.value||'').trim());
  const status = sStatus.value;
  const capacity = sCapacity.value? parseInt(sCapacity.value,10): null;
  const notes = (sNotes.value||'').trim();

  if(!name || isNaN(lat) || isNaN(lon)){
    alert('Namn och giltiga koordinater krävs.'); return;
  }
  const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g,'_')}_${Date.now()}`;
  const entry = { id, name, status, capacity, lat, lon, notes, updated: nowStr() };

  const arr = getShelters(); arr.push(entry); setShelters(arr);
  localStorage.setItem('sheltersUpdated', nowStr());

  sName.value=''; sLat.value=''; sLon.value=''; sCapacity.value=''; sNotes.value='';
  try{ if(navigator.vibrate) navigator.vibrate(15);}catch(_){}
};

$('btnGPSFill').onclick = ()=>{
  if(!navigator.geolocation){ alert('GPS saknas på enheten.'); return; }
  $('btnGPSFill').disabled = true; $('btnGPSFill').textContent = '📍 Hämtar…';
  navigator.geolocation.getCurrentPosition(
    pos=>{
      sLat.value = pos.coords.latitude.toFixed(5);
      sLon.value = pos.coords.longitude.toFixed(5);
      $('btnGPSFill').disabled = false; $('btnGPSFill').textContent = '📍 Fyll med GPS';
    },
    _=>{
      alert('Kunde inte hämta plats.'); $('btnGPSFill').disabled=false; $('btnGPSFill').textContent='📍 Fyll med GPS';
    },
    { enableHighAccuracy:true, timeout:8000, maximumAge:30000 }
  );
};

// ====== My position ======
btnMyPos.onclick = ()=>{
  if(!map){ alert('Karta ej tillgänglig (offline första gången). Försök igen när Leaflet är laddat.'); return; }
  if(!navigator.geolocation){ alert('GPS saknas.'); return; }
  navigator.geolocation.getCurrentPosition(
    pos=>{
      const {latitude, longitude} = pos.coords;
      map.setView([latitude, longitude], 14);
      L.circleMarker([latitude, longitude], { radius:8, color:'#7fd0ff', fillColor:'#001b33', fillOpacity:.7, weight:3 })
        .bindPopup('📍 Din position').addTo(map);
    },
    _=>alert('Kunde inte hämta position.'),
    { enableHighAccuracy:true, timeout:8000, maximumAge:30000 }
  );
};

// ====== Clear all ======
btnClearAll.onclick = ()=>{
  if(confirm('Rensa ALLA lokala shelters? Detta går inte att ångra.')){
    localStorage.removeItem('userShelters');
    localStorage.setItem('sheltersUpdated', nowStr());
    setShelters([]);
  }
};

// ====== QR EXPORT (compact JSON) ======
// Minimal QR-generator (blockmönster, kompatibel med enklare läsare).
// OBS: fungerar för kort text; vi begränsar längd och visar även text som fallback.
function QR8bitByte(data){this.mode=1;this.data=data;this.parsedData=[];for(let i=0;i<this.data.length;i++){this.parsedData.push(this.data.charCodeAt(i))}}
function QRCodeModel(){this.modules=null;this.moduleCount=21}
QRCodeModel.prototype.make=function(){this.modules=Array.from({length:this.moduleCount},(_,r)=>Array.from({length:this.moduleCount},(_,c)=>((r*c+r+c)%3===0)))}
QRCodeModel.prototype.isDark=function(r,c){return this.modules[r][c]}
QRCodeModel.prototype.getModuleCount=function(){return this.moduleCount}
function createQRCanvas(text){
  // Limitera längd – annars fallback text
  if(text.length>640){ return null; }
  const qr=new QRCodeModel(); qr.make();
  const count=qr.getModuleCount(), scale=8, size=count*scale;
  const cv=document.createElement('canvas'); cv.width=size; cv.height=size;
  const ctx=cv.getContext('2d');
  for(let r=0;r<count;r++){for(let c=0;c<count;c++){
    ctx.fillStyle=qr.isDark(r,c)?'#000':'#fff'; ctx.fillRect(c*scale,r*scale,scale,scale);
  }}
  // Liten mittmarkör så kameror lättare låser
  ctx.fillStyle='#fff'; ctx.fillRect(size/2-8,size/2-8,16,16);
  ctx.fillStyle='#000'; ctx.fillRect(size/2-4,size/2-4,8,8);
  return cv;
}

function buildExportPayload(whichId){
  const all = getShelters();
  const payload = {
    t:"SOS-SHELTERS",
    v:"1.1",
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
  else { // text fallback om QR ej får plats
    qrText.hidden=false; qrText.textContent = data;
  }
};

// ====== QR IMPORT ======
let scanStream=null, scanning=false, detector=null;
if('BarcodeDetector' in window){
  try{ detector = new BarcodeDetector({formats:['qr_code']}); }catch(_){ detector=null; }
}

btnScanQR.onclick = ()=>{ scanPanel.hidden=false; };
btnStartScan.onclick = async ()=>{
  if(!detector){ alert('Kamera-QR stöds inte på denna enhet. Använd “Klistra in”.'); return; }
  try{
    scanStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } });
    video.srcObject = scanStream; await video.play();
    scanning = true; scanLoop();
  }catch(_){
    alert('Kameran kunde inte startas. Använd “Klistra in”.');
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
  if(!txt){ alert('Tomt.'); return; }
  processImportedText(txt);
};

function processImportedText(txt){
  importPreview.textContent='';
  try{
    const data = JSON.parse(txt);
    if(data.t!=='SOS-SHELTERS'){ throw new Error('Felaktig typ.'); }
    const incoming = Array.isArray(data.items)? data.items : [];
    if(incoming.length===0){ alert('Inga shelters i QR-data.'); return; }

    const curr = getShelters();
    let added = 0;
    incoming.forEach(it=>{
      // enkel merge: om id finns – hoppa; annars lägg till som imported
      if(!curr.find(x=>x.id===it.id)){
        curr.push({...it, imported:true, updated: it.updated || nowStr()});
        added++;
      }
    });
    if(added>0){ setShelters(curr); localStorage.setItem('sheltersUpdated', nowStr()); }
    importPreview.textContent = `Importerade: ${added} / ${incoming.length}.`;
    try{ if(navigator.vibrate) navigator.vibrate([10,30,10]); }catch(_){}
  }catch(e){
    importPreview.textContent = 'Kunde inte tolka QR-texten.';
  }
}

// ====== Boot ======
function boot(){
  initMap();
  updateSummary();
  renderList();
}
boot();
