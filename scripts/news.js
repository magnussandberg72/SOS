// ✅ SOS News Module – with SR P1 + P4 Norrbotten (via AllOrigins proxy)
const SR_FEEDS = {
  p1: "https://api.allorigins.win/raw?url=https://api.sr.se/api/v2/news/episodes?programid=132&format=json",
  p4n: "https://api.allorigins.win/raw?url=https://api.sr.se/api/v2/news/episodes?programid=163&format=json"
};

let currentFeed = "p1";

async function loadNews() {
  const list = document.getElementById("newsList");
  const offlineMsg = document.getElementById("offlineMsg");
  list.innerHTML = "⏳ Loading latest verified reports from Sveriges Radio " +
                   (currentFeed === "p1" ? "P1..." : "P4 Norrbotten...");

  try {
    const res = await fetch(SR_FEEDS[currentFeed]);
    const data = await res.json();
    const items = data.episodes || [];
    if (!items.length) throw new Error("No items");

    offlineMsg.style.display = "none";
    list.innerHTML = "";

    items.slice(0, 10).forEach(item => {
      const el = document.createElement("div");
      el.style.marginBottom = "18px";
      el.innerHTML = `
        <h4 style="color:#ffd85c;margin-bottom:4px;">${item.title}</h4>
        <p style="font-size:0.9rem;color:#cfd8ff;margin-bottom:4px;">
          ${new Date(item.publishdateutc).toLocaleString()}
        </p>
        <p style="margin-bottom:4px;">${item.description || ""}</p>
        <a href="${item.url}" target="_blank"
           style="color:#9fb8ff;text-decoration:underline;">🔗 Read on Sveriges Radio</a>
      `;
      list.appendChild(el);
    });

    localStorage.setItem("sos.newsCache", JSON.stringify(items.slice(0, 10)));
  } catch (err) {
    console.warn("⚠️ SR fetch failed:", err);
    const cached = localStorage.getItem("sos.newsCache");
    if (cached) {
      offlineMsg.style.display = "block";
      list.innerHTML = "";
      JSON.parse(cached).forEach(c => {
        const el = document.createElement("div");
        el.innerHTML = `
          <h4 style="color:#ffd85c;margin-bottom:4px;">${c.title}</h4>
          <p style="margin-bottom:4px;">${c.description || ""}</p>`;
        list.appendChild(el);
      });
    } else {
      list.innerHTML = "⚠️ Could not load news — check your connection.";
    }
  }
}

// 🔄 Refresh button
document.querySelector("#refreshBtn")?.addEventListener("click", loadNews);

// 🔁 Channel toggle
document.querySelector("#toggleFeed")?.addEventListener("click", () => {
  currentFeed = currentFeed === "p1" ? "p4n" : "p1";
  document.getElementById("toggleFeed").textContent =
    currentFeed === "p1" ? "Switch to P4 Norrbotten" : "Switch to P1 National";
  loadNews();
});

loadNews();
