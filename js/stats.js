/**
 * @fileoverview Stats page module for MealFlow
 * Renders Chart.js line charts for calories and weight history.
 * Falls back to demo data when localStorage has no history.
 */

const HISTORY_KEY = "mealflow_history";

// Chart instances (kept to allow destruction on user switch)
let caloriesChartInstance = null;
let weightChartInstance = null;

// User-specific chart colors
const USER_COLORS = {
  florian: {
    line: "#e91e8c",
    fill: "rgba(233, 30, 140, 0.12)",
    point: "#c2185b"
  },
  naomi: {
    line: "#7c4dff",
    fill: "rgba(124, 77, 255, 0.12)",
    point: "#512da8"
  }
};

// ============================================================================
// DATA ACCESS
// ============================================================================

/**
 * Load full history object from localStorage.
 * Shape: { florian: { "YYYY-MM-DD": { calories, weight }, ... }, naomi: { ... } }
 * @returns {Object} History object (may be empty)
 */
function getHistoricalData() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn("Stats: failed to parse history from localStorage", e);
    return {};
  }
}

/**
 * Get last 30 days of data for a user.
 * Returns array of { date, calories, weight } sorted oldest → newest.
 * Missing days are included with null values so charts show gaps.
 * @param {string} user - "florian" or "naomi"
 * @returns {Array<{ date: string, calories: number|null, weight: number|null }>}
 */
function getHistoryForLast30Days(user) {
  const history = getHistoricalData();
  const userData = (history[user] || {});
  const result = [];

  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    // Local date (not UTC) so the day labels don't shift by one near midnight.
    const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const entry = userData[isoDate] || {};
    result.push({
      date: isoDate,
      calories: entry.calories != null ? entry.calories : null,
      weight: entry.weight != null ? entry.weight : null
    });
  }

  return result;
}

// ============================================================================
// CALCULATIONS
// ============================================================================

/**
 * Calculate average calories over available data points (skips null).
 * @param {Array} data - Array from getHistoryForLast30Days
 * @returns {number|null} Rounded average or null if no data
 */
function calculateAverageCalories(data) {
  const values = data.map(d => d.calories).filter(v => v != null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * Compare first vs last recorded weight to determine trend.
 * @param {Array} data - Array from getHistoryForLast30Days
 * @returns {{ direction: "up"|"down"|"stable", delta: number }|null}
 */
function calculateWeightTrend(data) {
  const weightPoints = data.filter(d => d.weight != null);
  if (weightPoints.length < 2) return null;

  const first = weightPoints[0].weight;
  const last = weightPoints[weightPoints.length - 1].weight;
  const delta = parseFloat((last - first).toFixed(1));

  let direction = "stable";
  if (delta > 0.1) direction = "up";
  else if (delta < -0.1) direction = "down";

  return { direction, delta };
}

// ============================================================================
// DEMO DATA
// ============================================================================

/**
 * Generate random realistic demo data for last 30 days.
 * Called only when localStorage is empty.
 * @returns {Object} History object with both users populated
 */
function generateDemoData() {
  function randBetween(min, max) {
    return Math.round((Math.random() * (max - min) + min) * 10) / 10;
  }

  const history = { florian: {}, naomi: {} };

  // Starting weight values
  let florianWeight = 75.0;
  let naomiWeight = 62.5;

  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    // Local date (not UTC) so the day labels don't shift by one near midnight.
    const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    // Florian: calories 1500–1800, weight drifts ±0.2 per day around 74.5–75.5
    florianWeight = Math.max(74.5, Math.min(75.5, florianWeight + randBetween(-0.2, 0.2)));
    history.florian[isoDate] = {
      calories: Math.round(randBetween(1500, 1800)),
      weight: parseFloat(florianWeight.toFixed(1))
    };

    // Naomi: calories 1200–1500, weight drifts ±0.15 per day around 62.0–63.0
    naomiWeight = Math.max(62.0, Math.min(63.0, naomiWeight + randBetween(-0.15, 0.15)));
    history.naomi[isoDate] = {
      calories: Math.round(randBetween(1200, 1500)),
      weight: parseFloat(naomiWeight.toFixed(1))
    };
  }

  return history;
}

/**
 * Ensure history has data; generate demo data if not.
 * @param {string} user
 * @returns {Array} 30-day history for user
 */
function ensureData(user) {
  const history = getHistoricalData();
  const hasData = history[user] && Object.keys(history[user]).length > 0;

  if (!hasData) {
    generateDemoData();
  }

  return getHistoryForLast30Days(user);
}

// ============================================================================
// CHART HELPERS
// ============================================================================

/**
 * Format ISO date to short French label for chart axis.
 * @param {string} isoDate - "YYYY-MM-DD"
 * @returns {string} "21 mai"
 */
function formatAxisDate(isoDate) {
  const months = [
    "jan", "fév", "mars", "avr", "mai", "juin",
    "juil", "août", "sept", "oct", "nov", "déc"
  ];
  const [, month, day] = isoDate.split("-");
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`;
}

/**
 * Destroy an existing Chart.js instance safely.
 * @param {Chart|null} chart
 */
function destroyChart(chart) {
  if (chart) {
    try { chart.destroy(); } catch (e) { /* ignore */ }
  }
}

// ============================================================================
// CHART RENDERING
// ============================================================================

/**
 * Render the calories line chart.
 * @param {string} user - "florian" or "naomi"
 * @param {Array} data - 30-day history array
 */
function renderCaloriesChart(user, data) {
  const canvas = document.getElementById("calories-chart");
  if (!canvas) return;

  destroyChart(caloriesChartInstance);

  const colors = USER_COLORS[user] || USER_COLORS.florian;
  const displayName = user.charAt(0).toUpperCase() + user.slice(1);

  caloriesChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels: data.map(d => formatAxisDate(d.date)),
      datasets: [{
        label: `Calories (${displayName})`,
        data: data.map(d => d.calories),
        borderColor: colors.line,
        backgroundColor: colors.fill,
        pointBackgroundColor: colors.point,
        pointBorderColor: colors.line,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.3,
        spanGaps: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            font: { size: 13 },
            color: "#333333",
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ctx.raw != null
              ? `${ctx.dataset.label}: ${ctx.raw} kcal`
              : `${ctx.dataset.label}: —`
          }
        },
        title: {
          display: false
        }
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 10,
            font: { size: 11 },
            color: "#666666",
            maxRotation: 30
          },
          grid: {
            color: "rgba(0,0,0,0.05)"
          }
        },
        y: {
          min: 0,
          max: 3000,
          title: {
            display: true,
            text: "kcal",
            font: { size: 12 },
            color: "#666666"
          },
          ticks: {
            font: { size: 11 },
            color: "#666666",
            stepSize: 500
          },
          grid: {
            color: "rgba(0,0,0,0.05)"
          }
        }
      }
    }
  });
}

/**
 * Render the weight line chart.
 * Y-axis range is based on data min/max ±2 kg.
 * @param {string} user - "florian" or "naomi"
 * @param {Array} data - 30-day history array
 */
function renderWeightChart(user, data) {
  const canvas = document.getElementById("weight-chart");
  if (!canvas) return;

  destroyChart(weightChartInstance);

  const colors = USER_COLORS[user] || USER_COLORS.florian;
  const displayName = user.charAt(0).toUpperCase() + user.slice(1);

  // Compute Y-axis range
  const weights = data.map(d => d.weight).filter(v => v != null);
  const minW = weights.length > 0 ? Math.min(...weights) : 60;
  const maxW = weights.length > 0 ? Math.max(...weights) : 80;
  const yMin = Math.floor(minW - 2);
  const yMax = Math.ceil(maxW + 2);

  weightChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels: data.map(d => formatAxisDate(d.date)),
      datasets: [{
        label: `Poids (${displayName})`,
        data: data.map(d => d.weight),
        borderColor: colors.line,
        backgroundColor: colors.fill,
        pointBackgroundColor: colors.point,
        pointBorderColor: colors.line,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.3,
        spanGaps: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            font: { size: 13 },
            color: "#333333",
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ctx.raw != null
              ? `${ctx.dataset.label}: ${ctx.raw} kg`
              : `${ctx.dataset.label}: —`
          }
        },
        title: {
          display: false
        }
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 10,
            font: { size: 11 },
            color: "#666666",
            maxRotation: 30
          },
          grid: {
            color: "rgba(0,0,0,0.05)"
          }
        },
        y: {
          min: yMin,
          max: yMax,
          title: {
            display: true,
            text: "kg",
            font: { size: 12 },
            color: "#666666"
          },
          ticks: {
            font: { size: 11 },
            color: "#666666",
            precision: 1
          },
          grid: {
            color: "rgba(0,0,0,0.05)"
          }
        }
      }
    }
  });
}

// ============================================================================
// SUMMARY
// ============================================================================

/**
 * Render summary statistics below the charts.
 * @param {Array} data - 30-day history array
 */
function renderSummary(data) {
  // Average calories
  const avgCaloriesEl = document.getElementById("avg-calories");
  if (avgCaloriesEl) {
    const avg = calculateAverageCalories(data);
    avgCaloriesEl.textContent = avg != null ? `${avg} kcal` : "—";
    avgCaloriesEl.className = "value";
  }

  // Weight trend
  const weightTrendEl = document.getElementById("weight-trend");
  if (weightTrendEl) {
    const trend = calculateWeightTrend(data);
    if (!trend) {
      weightTrendEl.textContent = "—";
      weightTrendEl.className = "value";
    } else if (trend.direction === "up") {
      const sign = trend.delta > 0 ? "+" : "";
      weightTrendEl.textContent = `↑ ${sign}${trend.delta} kg`;
      weightTrendEl.className = "value trend-up";
    } else if (trend.direction === "down") {
      weightTrendEl.textContent = `↓ ${trend.delta} kg`;
      weightTrendEl.className = "value trend-down";
    } else {
      weightTrendEl.textContent = `~ 0 kg`;
      weightTrendEl.className = "value trend-neutral";
    }
  }

  // Days completed (days with at least calories recorded)
  const daysCompletedEl = document.getElementById("days-completed");
  if (daysCompletedEl) {
    const completed = data.filter(d => d.calories != null).length;
    daysCompletedEl.textContent = `${completed} / 30`;
    daysCompletedEl.className = "value";
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Main entry point. Load current user, fetch data, render charts + summary.
 */
function initializeStats() {
  // Determine current user via UserContext (loaded before this script)
  const user = (window.UserContext && window.UserContext.getCurrentUser)
    ? window.UserContext.getCurrentUser()
    : "florian";

  // Apply user body class for accent colors
  document.body.classList.remove("user-florian", "user-naomi");
  document.body.classList.add(`user-${user}`);

  // Get (or generate) data
  const data = ensureData(user);

  // Render charts
  renderCaloriesChart(user, data);
  renderWeightChart(user, data);

  // Render summary
  renderSummary(data);

  // Apply user background styling if UserContext is available
  if (window.UserContext && window.UserContext.applyUserStyling) {
    window.UserContext.applyUserStyling();
  }

  // Initialize user toggle button in header
  if (window.UserContext && window.UserContext.initializeUserToggle) {
    window.UserContext.initializeUserToggle();
  }
}

// Re-render on user switch (UserContext dispatches "userChanged")
document.addEventListener("userChanged", function(event) {
  const user = event.detail && event.detail.user ? event.detail.user : "florian";

  document.body.classList.remove("user-florian", "user-naomi");
  document.body.classList.add(`user-${user}`);

  const data = ensureData(user);
  renderCaloriesChart(user, data);
  renderWeightChart(user, data);
  renderSummary(data);
});

// Charts resize automatically because maintainAspectRatio + responsive are set.
// Chart.js listens to window resize internally; no manual handler needed.

// Boot
document.addEventListener("DOMContentLoaded", initializeStats);
