/**
 * Historique + Stats pour profils
 */

let historyCache = {};
let weightCache = {};
let activeCharts = {};
let currentStatsUser = null;
let currentStatsPeriod = 7;
let currentStatsTab = "calories";
let currentWeighUser = null;
let statsHandlersBound = false;

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

  Object.keys(grouped).sort().reverse().forEach(date => {
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
        <div style="font-weight:bold; width:50px;">${Utils.escapeHTML(item.Heure)}</div>
        <div>${Utils.escapeHTML(item.Nom)}</div>
        <div style="text-align:right; min-width:60px;">${Utils.escapeHTML(item.Quantité)}${Utils.escapeHTML(item.Unité)}</div>
        <div style="text-align:right; min-width:60px; color:var(--color-primary); font-weight:bold;">${Utils.escapeHTML(item.Kcal_total)}kcal</div>
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

function bindStatsHandlers() {
  if (statsHandlersBound) return;
  statsHandlersBound = true;

  document.querySelectorAll(".period-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const days = parseInt(btn.dataset.days);
      document.querySelectorAll(".period-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentStatsPeriod = days;
      renderActiveStatsChart();
    });
  });

  document.querySelectorAll(".stats-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.tab;
      document.querySelectorAll(".stats-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentStatsTab = name;

      const calCanvas = document.getElementById("chart-calories");
      const poidsCanvas = document.getElementById("chart-poids");
      calCanvas.style.display = name === "calories" ? "" : "none";
      poidsCanvas.style.display = name === "poids" ? "" : "none";

      renderActiveStatsChart();
    });
  });
}

function renderActiveStatsChart() {
  if (currentStatsTab === "poids") {
    destroyChart("chart-poids");
    renderWeightChart(currentStatsUser, currentStatsPeriod);
  } else {
    destroyChart("chart-calories");
    renderCaloriesChart(currentStatsUser, currentStatsPeriod);
  }
}

function openStatsModal(userId) {
  currentStatsUser = userId;
  currentStatsTab = "calories";
  currentStatsPeriod = 7;
  document.getElementById("modal-stats").classList.add("open");
  document.getElementById("stats-modal-title").textContent = `Statistiques — ${profilesData[userId]?.Prénom || userId}`;

  // Reset tab + period button states
  document.querySelectorAll(".stats-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === "calories"));
  document.querySelectorAll(".period-btn").forEach(b => b.classList.toggle("active", b.dataset.days === "7"));
  document.getElementById("chart-calories").style.display = "";
  document.getElementById("chart-poids").style.display = "none";

  bindStatsHandlers();

  loadUserHistory(userId).then(() => {
    renderCaloriesChart(userId, currentStatsPeriod);
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

// ============================================================================
// Pesée (weight tracking) — one row per weigh-in in History_<user>
// Row: [Date, Heure, "Pesée", poids, "kg", 0, "poids"]
// Re-weighing the same day updates that day's row (no duplicate).
// ============================================================================

const WEIGHT_ROW_TYPE = "poids";

/**
 * Normalize a sheet date string to ISO YYYY-MM-DD.
 * Accepts ISO ("2026-05-24"...) and FR ("24/05/2026") formats.
 * @param {string} s
 * @returns {string}
 */
function normalizeDateISO(s) {
  s = (s || "").trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (fr) return `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
  return s;
}

/**
 * Load the weight map {YYYY-MM-DD: kg} for a user from History_<user>.
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function loadUserWeights(userId) {
  if (weightCache[userId]) return weightCache[userId];

  try {
    const rows = await SheetsAPI.readSheetTab(`History_${userId}`);
    const map = {};
    (rows || []).forEach(r => {
      if ((r[6] || "") === WEIGHT_ROW_TYPE && r[0]) {
        const kg = parseFloat(r[3]);
        if (!isNaN(kg)) map[normalizeDateISO(r[0])] = kg;
      }
    });
    weightCache[userId] = map;
    return map;
  } catch (err) {
    console.error(`Failed to load weights for ${userId}:`, err);
    return {};
  }
}

function openWeighModal(userId) {
  currentWeighUser = userId;
  document.getElementById("modal-weigh").classList.add("open");
  document.getElementById("weigh-modal-title").textContent = `Pesée — ${profilesData[userId]?.Prénom || userId}`;

  const input = document.getElementById("field-weigh");
  input.value = "";

  // Pre-fill with most recent known weight, else profile Poids_kg
  loadUserWeights(userId).then(map => {
    const dates = Object.keys(map).sort();
    if (dates.length > 0) {
      input.value = map[dates[dates.length - 1]];
    } else if (profilesData[userId]?.Poids_kg) {
      input.value = profilesData[userId].Poids_kg;
    }
    input.focus();
    input.select();
  });
}

function closeWeighModal() {
  document.getElementById("modal-weigh").classList.remove("open");
  currentWeighUser = null;
}

async function saveWeight() {
  const userId = currentWeighUser;
  if (!userId) return;

  const input = document.getElementById("field-weigh");
  const value = parseFloat((input.value || "").replace(",", ".")); // accept French comma decimals
  if (!value || value <= 0) {
    alert("Veuillez entrer un poids valide.");
    return;
  }

  const token = window.getAccessToken ? window.getAccessToken() : null;
  if (!token) {
    alert("Connexion Google requise pour enregistrer la pesée.");
    return;
  }

  const btn = document.getElementById("btn-save-weigh");
  btn.disabled = true;

  try {
    const tabName = `History_${userId}`;

    // Ensure the history sheet exists (create with header if missing)
    let rows;
    try {
      rows = await SheetsAPI.readSheetTab(tabName);
    } catch (_) {
      await SheetsAPI.createSheetTab(tabName, ["Date", "Heure", "Nom", "Quantité", "Unité", "Kcal_total", "Type"], token);
      rows = await SheetsAPI.readSheetTab(tabName);
    }

    // Locate today's existing weight row (1-based index for the A1 range)
    const today = Utils.getDateISO(0);
    let weightRowNum = 0;
    (rows || []).forEach((r, idx) => {
      if ((r[6] || "") === WEIGHT_ROW_TYPE && r[0] === today) {
        weightRowNum = idx + 1;
      }
    });

    const time = new Date().toTimeString().slice(0, 5);
    const newRow = [today, time, "Pesée", value, "kg", 0, WEIGHT_ROW_TYPE];

    if (weightRowNum > 0) {
      await SheetsAPI.batchUpdateRange(`${tabName}!A${weightRowNum}:G${weightRowNum}`, [newRow], token);
    } else {
      await SheetsAPI.appendRowWithToken(tabName, newRow, token);
    }

    weightCache[userId] = null;
    closeWeighModal();

    // Refresh weight chart if Stats modal is open on the weight tab for this user
    if (currentStatsUser === userId &&
        document.getElementById("modal-stats").classList.contains("open") &&
        currentStatsTab === "poids") {
      destroyChart("chart-poids");
      renderWeightChart(userId, currentStatsPeriod);
    }

    if (window.Toast) Toast.success("Pesée enregistrée ✓");
  } catch (err) {
    console.error("Failed to save weight:", err);
    alert("La pesée n'a pas pu être enregistrée.");
  } finally {
    btn.disabled = false;
  }
}

function renderWeightChart(userId, days) {
  loadUserWeights(userId).then(weights => {
    const today = new Date();
    const labels = [];
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      labels.push(new Date(dateStr + "T00:00:00").toLocaleDateString("fr-FR", { month: "short", day: "numeric" }));
      data.push(weights.hasOwnProperty(dateStr) ? weights[dateStr] : null);
    }

    const ctx = document.getElementById("chart-poids").getContext("2d");
    destroyChart("chart-poids");

    // Tight bounds around real values so the axis shows decimal granularity
    const values = data.filter(v => v !== null && v !== undefined);
    let yMin, yMax;
    if (values.length) {
      const dataMin = Math.min(...values);
      const dataMax = Math.max(...values);
      const range = dataMax - dataMin;
      const pad = range === 0 ? 1 : Math.max(range * 0.15, 0.5);
      yMin = Math.floor((dataMin - pad) * 10) / 10;
      yMax = Math.ceil((dataMax + pad) * 10) / 10;
    }

    activeCharts["chart-poids"] = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Poids (kg)",
            data: data,
            borderColor: "var(--color-primary)",
            backgroundColor: "rgba(46, 125, 50, 0.1)",
            tension: 0.4,
            fill: true,
            spanGaps: true,
            pointRadius: 4,
            pointBackgroundColor: "var(--color-primary)"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: true, position: "top" },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.parsed.y != null ? `${ctx.parsed.y.toFixed(1)} kg` : ""
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            min: yMin,
            max: yMax,
            ticks: {
              callback: (value) => Number(value).toFixed(1)
            }
          }
        }
      }
    });
  });
}

