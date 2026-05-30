/**
 * @fileoverview Recipe utilities module for MealFlow
 * Provides helper functions for recipe ID generation, calorie calculations, and inventory searching
 */

/**
 * Generate a URL-safe recipe ID from recipe name
 * @param {string} name - Recipe name
 * @returns {string} Lowercase slug (e.g., "Pâtes carbonara" → "pates_carbonara")
 */
function generateRecipeID(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[ïî]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Unit conversion table: unit → grams conversion factor
 * Default conversions used for all products unless overridden
 */
const UNIT_CONVERSION_TABLE = {
  'g': 1,
  'ml': 1,
  'litre': 1000,
  'piece': 100,
  'pièce': 100
};

/**
 * Map of product name (normalized) → conversion_factor
 * Loaded from Inventory sheet column F
 * Used to override default 'piece' conversion per product
 */
let productConversionFactorMap = {};

/**
 * Load conversion factors from Inventory sheet
 * Maps product names to their piece→gram conversions
 */
async function loadConversionFactors() {
  try {
    if (!window.SheetsAPI) return;
    const rows = await window.SheetsAPI.readSheetTab('Inventory');
    const objects = window.SheetsAPI.rowsToObjects(rows);

    productConversionFactorMap = {};
    objects.forEach(row => {
      if (row.Produit && row.Conversion_factor) {
        const key = (row.Produit || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
        productConversionFactorMap[key] = parseFloat(row.Conversion_factor);
      }
    });
    console.log(`Loaded ${Object.keys(productConversionFactorMap).length} product conversion factors`);
  } catch (err) {
    console.warn('Failed to load conversion factors:', err);
  }
}

/**
 * Get conversion factor for a product
 * @param {string} productName - product name
 * @returns {number|null} conversion factor or null if not found
 */
function getProductConversionFactor(productName) {
  if (!productName) return null;
  const key = productName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
  return productConversionFactorMap[key] || null;
}

/**
 * Convert quantity from any unit to grams
 * @param {number} qty - quantity value
 * @param {string} unit - unit name (g, ml, piece, litre, etc)
 * @param {number} productConversionFactor - per-product override for piece/pièce (e.g., 200 for tomate)
 * @returns {number} quantity in grams (0 if unit not convertible)
 */
function convertToGrams(qty, unit, productConversionFactor = null) {
  let factor = UNIT_CONVERSION_TABLE[unit] || 0;

  // If piece/pièce and product has custom conversion, use it
  if ((unit === 'piece' || unit === 'pièce') && productConversionFactor) {
    factor = parseFloat(productConversionFactor);
  }

  return (parseFloat(qty) || 0) * factor;
}

/**
 * Calculate total calories and per 100g for a recipe
 * @param {Object[]} ingredients - Array of {name, quantity, unit, calories_per_100}
 * @returns {Object} {total_kcal, total_weight_grams, kcal_per_100}
 */
function calculateRecipeCalories(ingredients) {
  let totalKcal = 0;
  let totalWeightGrams = 0;

  ingredients.forEach(ing => {
    const qty = parseFloat(ing.quantity) || 0;
    const cal100 = parseFloat(ing.calories_per_100) || 0;
    const unit = ing.unit || 'g';

    const qtyGrams = convertToGrams(qty, unit);
    totalWeightGrams += qtyGrams;
    totalKcal += cal100 * (qtyGrams / 100);
  });

  const kcalPer100 = totalWeightGrams > 0 ? totalKcal / (totalWeightGrams / 100) : 0;

  return {
    total_kcal: Math.round(totalKcal),
    total_weight_grams: Math.round(totalWeightGrams),
    kcal_per_100: Math.round(kcalPer100)
  };
}

/**
 * Search inventory for matching products
 * @param {string} query - Search query
 * @returns {Object[]} Matching items [{name, calories_per_100, unit, ...}]
 */
function searchInventoryProducts(query) {
  if (!query || query.length < 2) return [];
  if (!window.inventoryData) return [];

  const q = query.toLowerCase();
  return window.inventoryData
    .filter(item => {
      const prodName = (item.Produit || '').toLowerCase();
      return prodName.includes(q) && parseFloat(item.Qty) > 0;
    })
    .map(item => ({
      name: item.Produit,
      calories_per_100: parseFloat(item.calories_per_100) || 0,
      unit: item.Unité || 'g'
    }))
    .slice(0, 10); // Top 10 results
}

// Export all functions
const RecettesUtils = {
  generateRecipeID,
  calculateRecipeCalories,
  searchInventoryProducts
};

// Export for both browser (window.RecettesUtils) and Node.js (module.exports)
if (typeof window !== 'undefined') {
  window.RecettesUtils = RecettesUtils;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RecettesUtils;
}
