/**
 * Historique + Stats pour profils
 */

let historyCache = {};
let activeCharts = {};
let currentStatsUser = null;
let currentStatsPeriod = 7;

async function loadUserHistory(userId) {
  if (historyCache[userId]) return historyCache[userId];

  try {
    const rows = await SheetsAPI.readSheetTab(`History_${userId}`);
    const objects = SheetsAPI.rowsToObjects(rows);

    historyCache[userId] = objects.map(row => ({
      Date: row.Date || "",
      Heure: row.Time || row.Heure || "",
      Nom: row.Product || row.Nom || "",
      Quantité: parseFloat(row.Quantity || row.Quantité || row.Quantitée) || 0,
      Unité: row.Unit || row.Unité || "",
      Kcal_total: parseFloat(row.Total_calories || row.Kcal_total) || 0,
      Type: row.Type || "autre"
    })).filter(r => r.Date && r.Nom).reverse();

    return historyCache[userId];
  } catch (err) {
    console.error(`Failed to load history for ${userId}:`, err);
    return [];
  }
}

function openHistoryModal(userId) {
  document.getElementById("modal-history").classList.add("open");
  document.getElementById("history-modal-title").textContent = `Historique — ${profilesData[userId]?.Prénom || userId}`;

  loadUserHistory(userId).then(history => {
    renderHistoryContent(history);
  });
}

function closeHistoryModal() {
  document.getElementById("modal-history").classList.remove("open");
}

function renderHistoryContent(history) {
  const container = document.getElementById("history-content");
  container.innerHTML = "";

  if (!history || history.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--color-text-light);">Aucune données</p>';
    return;
  }

  const grouped = {};
  history.forEach(item => {
    if (!grouped[item.Date]) {
      grouped[item.Date] = [];
    }
    grouped[item.Date].push(item);
  });

  Object.keys(grouped).reverse().forEach(date => {
    const items = grouped[date];
    const totalKcal = items.reduce((sum, i) => sum + i.Kcal_total, 0);

    const dayDiv = document.createElement("div");
    dayDiv.className = "history-day";

    const dateStr = new Date(date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "2-digit", day: "2-digit" });

    const headerDiv = document.createElement("div");
    headerDiv.className = "history-day-header";
    headerDiv.innerHTML = `<span>${dateStr} — ${totalKcal} kcal</span> <span class="history-chevron">▼</span>`;
    headerDiv.style.cursor = "pointer";

    const detailDiv = document.createElement("div");
    detailDiv.className = "history-day-detail";

    items.forEach(item => {
      const entryDiv = document.createElement("div");
      entryDiv.className = "history-entry";
      entryDiv.innerHTML = `
        <div style="font-weight:bold; width:50px;">${item.Heure}</div>
        <div>${item.Nom}</div>
        <div style="text-align:right; min-width:60px;">${item.Quantité}${item.Unité}</div>
        <div style="text-align:right; min-width:60px; color:var(--color-primary); font-weight:bold;">${item.Kcal_total}kcal</div>
      `;
      detailDiv.appendChild(entryDiv);
    });

    headerDiv.addEventListener("click", () => {
      detailDiv.classList.toggle("open");
      headerDiv.querySelector(".history-chevron").classList.toggle("open");
    });

    dayDiv.appendChild(headerDiv);
    dayDiv.appendChild(detailDiv);
    container.appendChild(dayDiv);
  });
}

function openStatsModal(userId) {
  currentStatsUser = userId;
  document.getElementById("modal-stats").classList.add("open");
  document.getElementById("stats-modal-title").textContent = `Statistiques — ${profilesData[userId]?.Prénom || userId}`;

  loadUserHistory(userId).then(history => {
    renderCaloriesChart(userId, 7);

    document.querySelectorAll(".period-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const days = parseInt(btn.dataset.days);
        document.querySelectorAll(".period-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        currentStatsPeriod = days;
        destroyChart("chart-calories");
        renderCaloriesChart(currentStatsUser, days);
      });
    });
  });
}

function closeStatsModal() {
  document.getElementById("modal-stats").classList.remove("open");
  destroyAllCharts();
}

function destroyChart(id) {
  if (activeCharts[id]) {
    activeCharts[id].destroy();
    delete activeCharts[id];
  }
}

function destroyAllCharts() {
  Object.keys(activeCharts).forEach(id => {
    activeCharts[id].destroy();
  });
  activeCharts = {};
}

function renderCaloriesChart(userId, days) {
  loadUserHistory(userId).then(history => {
    const today = new Date();
    const grouped = {};

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      grouped[dateStr] = 0;
    }

    history.forEach(item => {
      if (grouped.hasOwnProperty(item.Date)) {
        grouped[item.Date] += item.Kcal_total;
      }
    });

    const labels = Object.keys(grouped).map(d => {
      const date = new Date(d + "T00:00:00");
      return date.toLocaleDateString("fr-FR", { month: "short", day: "numeric" });
    });
    const data = Object.values(grouped);

    const targetKcal = profilesData[userId]?.Calories_cible || 2000;
    const targetLine = new Array(labels.length).fill(targetKcal);

    const ctx = document.getElementById("chart-calories").getContext("2d");

    destroyChart("chart-calories");

    activeCharts["chart-calories"] = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Calories consommées",
            data: data,
            borderColor: "var(--color-primary)",
            backgroundColor: "rgba(46, 125, 50, 0.1)",
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: "var(--color-primary)"
          },
          {
            label: "Objectif",
            data: targetLine,
            borderColor: "#f44336",
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: true, position: "top" }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  });
}

