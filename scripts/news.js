// 🔹 SOS Emergency News (Sveriges Radio P1 Feed)
const feedUrl = "https://api.sr.se/api/rss/program/132";
const container = document.getElementById("newsList");
const offlineMsg = document.getElementById("offlineMsg");

// Load from SR P1 RSS
async function loadP1News() {
  try {
    const response = await fetch(feedUrl);
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "application/xml");
    const items = xml.querySelectorAll("item");

    let html = "";
    let newsArray = [];

    items.forEach((item, index) => {
      if (index >= 8) return; // show only 8 latest
      const title = item.querySelector("title")?.textContent || "";
      const link = item.querySelector("link")?.textContent || "#";
      const desc = item.querySelector("description")?.textContent || "";
      const pubDate = item.querySelector("pubDate")?.textContent || "";

      newsArray.push({ title, link, desc, pubDate });

      html += `
        <div class="news-container">
          <h3>📰 ${title}</h3>
          <p class="time">${pubDate}</p>
          <p>${desc}</p>
          <p><a href="${link}" target="_blank" style="color:#ffd85c; text-decoration:none;">🔗 Läs mer på Sveriges Radio</a></p>
        </div>
      `;
    });

    // Render
    container.innerHTML = html;
    // Save to localStorage
    localStorage.setItem("sos.news", JSON.stringify(newsArray));
  } catch (err) {
    console.warn("⚠️ Could not load SR P1 feed:", err);
    // Fallback to saved
    showSavedNews();
  }
}

// Show saved (offline)
function showSavedNews() {
  const saved = localStorage.getItem("sos.news");
  if (!saved) {
    container.innerHTML = `
      <div class="offline">
        📡 Offline mode – no saved news available.<br>
        <span class="en">Offline-läge – inga sparade nyheter.</span>
      </div>`;
    return;
  }

  const list = JSON.parse(saved);
  let html = "";
  list.forEach(item => {
    html += `
      <div class="news-container">
        <h3>📰 ${item.title}</h3>
        <p class="time">${item.pubDate}</p>
        <p>${item.desc}</p>
        <p><a href="${item.link}" target="_blank" style="color:#ffd85c; text-decoration:none;">🔗 Läs mer på Sveriges Radio</a></p>
      </div>`;
  });
  container.innerHTML = html;
}

// Detect connection
function updateOnlineStatus() {
  if (navigator.onLine) {
    offlineMsg.style.display = "none";
    loadP1News();
  } else {
    offlineMsg.style.display = "block";
    showSavedNews();
  }
}

// Init
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();
