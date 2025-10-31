// ====== State & helpers ======
const $ = (id)=>document.getElementById(id);
const chipTotal = $('chipTotal'), chipUpdated = $('chipUpdated'), chipNet = $('chipNet');
const listBox = $('shelterList');
const btnMyPos = $('btnMyPos'), btnClearAll = $('btnClearAll');
const sName = $('sName'), sLat = $('sLat'), sLon = $('sLon'), sStatus = $('sStatus'), sCapacity = $('sCapacity'), sNotes = $('sNotes');
const btnAdd = $('btnAdd'), btnGPSFill = $('btnGPSFill');

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

// Default example (only first time)
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
    // No Leaflet → show fallback panel
    fallback.hidden = false;
    console.warn('Map unavailable (likely offline first-run or blocked):', e.message);
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
      <small>${sh.lat.toFixed(5)}, ${sh.lon.toFixed(5)} | Kapacitet: ${sh.capacity??'—'} | ${sh.updated}</small>
      ${sh.notes? `<p style="margin:6px 0 0">${sh.notes}</p>`:''}
      <div class="rowBtns">
        <button class="btn sm ghost" data-action="center">🎯 Centra</button>
        <button class="btn sm danger" data-action="delete">🗑️ Ta bort</button>
      </div>
    `;
    el.querySelector('[data-action="center"]').onclick = ()=>{
      if(map) { map.setView([sh.lat, sh.lon], Math.max(14, map.getZoom())); }
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
btnAdd.onclick = ()=>{
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

  // reset form
  sName.value=''; sLat.value=''; sLon.value=''; sCapacity.value=''; sNotes.value='';
  try{ if(navigator.vibrate) navigator.vibrate(15);}catch(_){}
};

btnGPSFill.onclick = ()=>{
  if(!navigator.geolocation){ alert('GPS saknas på enheten.'); return; }
  btnGPSFill.disabled = true; btnGPSFill.textContent = '📍 Hämtar…';
  navigator.geolocation.getCurrentPosition(
    pos=>{
      sLat.value = pos.coords.latitude.toFixed(5);
      sLon.value = pos.coords.longitude.toFixed(5);
      btnGPSFill.disabled = false; btnGPSFill.textContent = '📍 Fyll med GPS';
    },
    _=>{
      alert('Kunde inte hämta plats.'); btnGPSFill.disabled=false; btnGPSFill.textContent='📍 Fyll med GPS';
    },
    { enableHighAccuracy:true, timeout:8000, maximumAge:30000 }
  );
};

// ====== My position on map ======
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

// ====== Boot ======
function boot(){
  initMap();
  updateSummary();
  renderList();
}
boot();
