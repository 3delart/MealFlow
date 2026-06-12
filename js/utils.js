/**
 * @fileoverview Shared utilities module for MealFlow
 * Provides date utilities, BMR/TDEE calculations, and DOM helpers
 */

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 * @returns {string} ISO date string for today
 */
function getTodayISO() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Get a date in ISO format relative to today
 * @param {number} daysOffset - Number of days from today (0 = today, 1 = tomorrow, -1 = yesterday)
 * @returns {string} ISO date string
 */
function getDateISO(daysOffset) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}

/**
 * Parse an ISO date string to a Date object
 * @param {string} isoString - ISO date string (YYYY-MM-DD)
 * @returns {Date} Parsed Date object
 */
function parseISO(isoString) {
  const [year, month, day] = isoString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get the 3-letter French day abbreviation for a date
 * @param {string} isoString - ISO date string (YYYY-MM-DD)
 * @returns {string} Day abbreviation (Dim, Lun, Mar, Mer, Jeu, Ven, Sam)
 */
function getDayName(isoString) {
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const date = parseISO(isoString);
  return days[date.getDay()];
}

/**
 * Format a date as French text
 * @param {string} isoString - ISO date string (YYYY-MM-DD)
 * @returns {string} Formatted date (e.g., "Lun 18 mai")
 */
function formatDate(isoString) {
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];
  const date = parseISO(isoString);
  const dayName = getDayName(isoString);
  const day = date.getDate();
  const month = months[date.getMonth()];
  return `${dayName} ${day} ${month}`;
}

/**
 * Calculate days until expiration (negative = past date)
 * @param {string} expirationISO - ISO date string (YYYY-MM-DD)
 * @returns {number} Days remaining (negative if expired)
 */
function daysUntilExpiration(expirationISO) {
  const today = parseISO(getTodayISO());
  const expiration = parseISO(expirationISO);
  const diffTime = expiration - today;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Check if a date has passed expiration
 * @param {string} expirationISO - ISO date string (YYYY-MM-DD)
 * @returns {boolean} True if expired
 */
function isExpired(expirationISO) {
  return daysUntilExpiration(expirationISO) < 0;
}

/**
 * Check if a date is expiring soon (less than 3 days)
 * @param {string} expirationISO - ISO date string (YYYY-MM-DD)
 * @returns {boolean} True if expiring soon
 */
function isExpiringS(expirationISO) {
  const daysLeft = daysUntilExpiration(expirationISO);
  return daysLeft >= 0 && daysLeft < 3;
}

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor formula
 * @param {number} weightKg - Weight in kilograms
 * @param {number} heightCm - Height in centimeters
 * @param {number} ageYears - Age in years
 * @param {string} sex - Sex ('M' for male, 'F' for female)
 * @returns {number} BMR in kcal/day
 */
function calculateBMR(weightKg, heightCm, ageYears, sex) {
  const baseBMR = (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears);
  if (sex.toUpperCase() === 'M') {
    return baseBMR + 5;
  } else if (sex.toUpperCase() === 'F') {
    return baseBMR - 161;
  }
  return baseBMR;
}

/**
 * Calculate Total Daily Energy Expenditure
 * @param {number} bmr - Basal Metabolic Rate
 * @param {string} activity - Activity level
 *   - "Sédentaire" (1.2)
 *   - "Léger" (1.375)
 *   - "Modéré" (1.55)
 *   - "Actif" (1.725)
 *   - "Très actif" (1.9)
 * @returns {number} TDEE in kcal/day (rounded)
 */
function calculateTDEE(bmr, activity) {
  const activityMultipliers = {
    'Sédentaire': 1.2,
    'Léger': 1.375,
    'Modéré': 1.55,
    'Actif': 1.725,
    'Très actif': 1.9
  };
  const multiplier = activityMultipliers[activity] || 1.2;
  return Math.round(bmr * multiplier);
}

/**
 * Calculate target calories based on objective
 * @param {number} tdee - Total Daily Energy Expenditure
 * @param {string} objectif - Objective
 *   - "Perte légère" (-250)
 *   - "Perte modérée" (-500)
 *   - "Perte agressive" (-750)
 *   - "Maintien" (0)
 *   - "Prise de masse" (+300)
 * @returns {number} Target calories (rounded)
 */
function calculateObjectiveCalories(tdee, objectif) {
  const adjustments = {
    'Perte légère': -250,
    'Perte modérée': -500,
    'Perte agressive': -750,
    'Maintien': 0,
    'Prise de masse': 300
  };
  const adjustment = adjustments[objectif] || 0;
  return Math.round(tdee + adjustment);
}

/**
 * Create a DOM element with attributes and content
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes object (e.g., {id: "test", className: "my-class"})
 * @param {string} content - Element text content
 * @returns {HTMLElement} Created element
 */
function createElement(tag, attrs = {}, content = '') {
  const element = document.createElement(tag);

  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else {
      element.setAttribute(key, value);
    }
  });

  if (content) {
    element.textContent = content;
  }

  return element;
}

/**
 * Remove all children from a DOM element
 * @param {HTMLElement} el - Element to clear
 */
function clearElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Escape HTML special characters to prevent XSS when injecting via innerHTML.
 * Use on any value coming from Google Sheets, Open Food Facts, or user input.
 * @param {*} value - Value to escape (coerced to string)
 * @returns {string} HTML-safe string
 */
function escapeHTML(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normalize a string for accent-insensitive, case-insensitive comparison/search.
 * Lowercases, strips diacritics (NFD), and trims.
 * @param {*} value - Value to normalize
 * @returns {string} Normalized string
 */
function normalizeString(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Canonical key for matching food/product names across recipes, inventory and
 * the shopping list. On top of normalizeString it collapses internal whitespace
 * and drops a trailing plural "s", so "Tomates" and "tomate" resolve to the same
 * key — without the false positives of substring matching ("ail" vs "ailes").
 * @param {*} value
 * @returns {string}
 */
function foodKey(value) {
  return normalizeString(value).replace(/\s+/g, ' ').replace(/s$/, '');
}

/**
 * Whether two food/product names refer to the same item (plural/whitespace tolerant).
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
function foodMatch(a, b) {
  const ka = foodKey(a);
  return ka.length > 0 && ka === foodKey(b);
}

/**
 * Create a debounced version of a function.
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, ms = 250) {
  let timer = null;
  return function debounced(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Default price reference unit derived from a product's storage unit.
 * Mass (g) → kg, volume (ml/litre) → L, count (pièce) → pièce.
 * @param {string} productUnit
 * @returns {'kg'|'L'|'pièce'}
 */
function defaultPriceUnit(productUnit) {
  if (productUnit === 'ml' || productUnit === 'litre') return 'L';
  if (productUnit === 'pièce' || productUnit === 'piece') return 'pièce';
  return 'kg';
}

/**
 * Resolve the price unit to display: stored value if present, else derived default.
 * @param {string} priceUnit - stored Prix_unité ('' if unset)
 * @param {string} productUnit - product's Unité
 * @returns {string} e.g. 'kg', 'L', 'pièce'
 */
function priceUnitLabel(priceUnit, productUnit) {
  return priceUnit || defaultPriceUnit(productUnit);
}

/**
 * Lightweight toast notifications. Self-injects its container and styles,
 * so no per-page HTML is required. Call Toast.show / .success / .error.
 */
const Toast = (() => {
  let container = null;

  function ensureContainer() {
    if (container) return container;
    const style = document.createElement('style');
    style.textContent = `
      #mf-toast-container { position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        z-index: 10000; display: flex; flex-direction: column; gap: 8px; align-items: center;
        pointer-events: none; width: max-content; max-width: 90vw; }
      .mf-toast { padding: 10px 16px; border-radius: 8px; color: #fff; font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25); opacity: 0; transform: translateY(10px);
        transition: opacity .2s, transform .2s; }
      .mf-toast.show { opacity: 1; transform: translateY(0); }
      .mf-toast-success { background: #2e7d32; }
      .mf-toast-error { background: #c62828; }
      .mf-toast-info { background: #455a64; }
    `;
    document.head.appendChild(style);
    container = document.createElement('div');
    container.id = 'mf-toast-container';
    document.body.appendChild(container);
    return container;
  }

  function show(message, type = 'info', duration = 3000) {
    if (typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.className = `mf-toast mf-toast-${type}`;
    el.textContent = message;
    ensureContainer().appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 200);
    }, duration);
  }

  return {
    show,
    success: (m, d) => show(m, 'success', d),
    error: (m, d) => show(m, 'error', d || 4000),
    info: (m, d) => show(m, 'info', d)
  };
})();

// Export all functions
const Utils = {
  getTodayISO,
  getDateISO,
  parseISO,
  getDayName,
  formatDate,
  daysUntilExpiration,
  isExpired,
  isExpiringS,
  calculateBMR,
  calculateTDEE,
  calculateObjectiveCalories,
  createElement,
  clearElement,
  escapeHTML,
  normalizeString,
  foodKey,
  foodMatch,
  debounce,
  defaultPriceUnit,
  priceUnitLabel,
  Toast
};

// Export for both browser (window.Utils) and Node.js (module.exports)
if (typeof window !== 'undefined') {
  window.Utils = Utils;
  window.Toast = Toast;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}
