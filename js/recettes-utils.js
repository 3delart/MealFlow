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
  'kg': 1000,
  'ml': 1,
  'cl': 10,
  'dl': 100,
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
        const key = Utils.normalizeString(row.Produit);
        productConversionFactorMap[key] = parseFloat(row.Conversion_factor);
      }
    });
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
  const key = Utils.normalizeString(productName);
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
 * Convert a quantity (in the product's unit) into the price reference unit
 * (kg, L or pièce), so it can be multiplied by a per-unit price.
 * @param {number} qty - quantity in productUnit
 * @param {string} productUnit - product storage unit (g, ml, litre, pièce)
 * @param {string} priceUnit - reference unit of the price (kg, L, pièce)
 * @param {number} conversionFactor - per-product piece→gram factor
 * @returns {number} quantity expressed in priceUnit
 */
function convertToPriceUnit(qty, productUnit, priceUnit, conversionFactor = null) {
  const grams = convertToGrams(qty, productUnit, conversionFactor);
  if (priceUnit === 'pièce' || priceUnit === 'piece') {
    return grams / (parseFloat(conversionFactor) || 100);
  }
  // kg and L both come from grams / 1000 (ml ≈ g, water equivalence)
  return grams / 1000;
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

    // For piece ingredients, look up conversion_factor from inventory
    let conversionFactor = null;
    if (unit === 'piece' || unit === 'pièce') {
      conversionFactor = getProductConversionFactor(ing.name);
    }

    const qtyGrams = convertToGrams(qty, unit, conversionFactor);
    const cookingFactor = parseFloat(ing.cooking_factor) || 1.0;
    totalWeightGrams += qtyGrams * cookingFactor;
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

  const q = Utils.normalizeString(query);
  return window.inventoryData
    .filter(item => {
      const prodName = Utils.normalizeString(item.Produit);
      return prodName.includes(q);
    })
    .map(item => ({
      name: item.Produit,
      calories_per_100: parseFloat(item.calories_per_100) || 0,
      unit: item.Unité || 'g',
      cooking_factor: parseFloat(item.cooking_factor) || 1.0
    }))
    .slice(0, 10); // Top 10 results
}

/**
 * Single source of truth for recipe categories (the "enum").
 * Drives both the form <select> and the grouped list order on recettes.html.
 */
const RECIPE_CATEGORIES = [
  "Petit déjeuner",
  "Repas",
  "Dessert",
  "Boisson",
  "Apéritif",
  "Encas",
  "Autre"
];

// Export all functions
const RecettesUtils = {
  generateRecipeID,
  calculateRecipeCalories,
  searchInventoryProducts,
  RECIPE_CATEGORIES
};

// Export for both browser (window.RecettesUtils) and Node.js (module.exports)
if (typeof window !== 'undefined') {
  window.RecettesUtils = RecettesUtils;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RecettesUtils;
}
