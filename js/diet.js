/**
 * @fileoverview Shared diet / allergy / aversion classification for the active profile.
 * Loaded by the recipes and planning pages. Depends on Utils, FoodConfig (config.js),
 * SheetsAPI, UserContext and window.inventoryData.
 */
const Diet = (() => {
  let allergies = [];   // normalized allergy labels of the active profile
  let aversions = [];   // normalized aversion labels (products or concepts)
  let regime = "";      // normalized dietary regime (e.g. "vegan")

  function _parseList(json) {
    try {
      const v = JSON.parse(json || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  /** Load the active profile's allergies, aversions and regime from the Profils sheet. */
  async function loadProfile() {
    allergies = []; aversions = []; regime = "";
    try {
      const user = window.UserContext ? UserContext.getCurrentUser() : "florian";
      const rows = await SheetsAPI.readSheetTab("Profils");
      const profile = SheetsAPI.rowsToObjects(rows)
        .find(p => (p.User || "").toLowerCase() === user);
      if (profile) {
        allergies = _parseList(profile.Allergies_JSON).map(Utils.normalizeString).filter(Boolean);
        aversions = _parseList(profile.Aversions_JSON).map(Utils.normalizeString).filter(Boolean);
        regime = Utils.normalizeString(profile["Régime"] || "");
      }
    } catch (err) {
      console.warn("Diet.loadProfile failed:", err);
    }
  }

  /** Classify an ingredient into food concepts (poisson, viande, lait, ...). */
  function classifyIngredient(ing) {
    const concepts = new Set();
    const cfg = window.FoodConfig;
    if (!cfg) return concepts;
    const normName = Utils.normalizeString(ing.name);
    const invItem = (window.inventoryData || [])
      .find(i => Utils.normalizeString(i.Produit) === normName);
    // Explicit per-product tags are authoritative
    if (invItem && Array.isArray(invItem.dietTags) && invItem.dietTags.length > 0) {
      invItem.dietTags.forEach(c => concepts.add(c));
      return concepts;
    }
    // Otherwise auto-detect from category + allergens + name keywords
    cfg.suggestDietConcepts(
      ing.name,
      invItem ? invItem.allergens : "",
      invItem ? invItem.Catégorie : ""
    ).forEach(c => concepts.add(c));
    return concepts;
  }

  function _aliases() {
    return (window.FoodConfig && window.FoodConfig.ALLERGY_ALIASES) || {};
  }

  function _invAllergens(ing) {
    const invItem = (window.inventoryData || [])
      .find(i => Utils.normalizeString(i.Produit) === Utils.normalizeString(ing.name));
    return invItem ? (invItem.allergens || "") : "";
  }

  /** Allergies an ingredient triggers (concept- and text-based). */
  function allergyHits(ing) {
    if (allergies.length === 0) return [];
    const concepts = classifyIngredient(ing);
    const aliases = _aliases();
    const hay = Utils.normalizeString(`${ing.name || ""} ${_invAllergens(ing)}`);
    return allergies.filter(a => concepts.has(a) || concepts.has(aliases[a]) || hay.includes(a));
  }

  /** Dietary-regime concepts an ingredient violates. */
  function dietViolations(ing) {
    const cfg = window.FoodConfig;
    if (!cfg || !regime) return [];
    const forbidden = cfg.DIET_RULES[regime];
    if (!forbidden) return [];
    const concepts = classifyIngredient(ing);
    return forbidden.filter(c => concepts.has(c));
  }

  /** Aversions an ingredient matches (by product name or concept). */
  function aversionHits(ing) {
    if (aversions.length === 0) return [];
    const n = Utils.normalizeString(ing.name);
    const concepts = classifyIngredient(ing);
    const aliases = _aliases();
    return aversions.filter(a =>
      n === a || n.includes(a) || a.includes(n) || concepts.has(a) || concepts.has(aliases[a]));
  }

  /**
   * Aggregate restrictions for a whole recipe.
   * @returns {{allergy:Set, diet:Set, aversion:Set, incompatible:boolean, regime:string}}
   */
  function recipeRestrictions(recipe) {
    const allergy = new Set(), diet = new Set(), aversion = new Set();
    (recipe.ingredients || []).forEach(ing => {
      allergyHits(ing).forEach(h => allergy.add(h));
      dietViolations(ing).forEach(h => diet.add(h));
      aversionHits(ing).forEach(h => aversion.add(h));
    });
    return {
      allergy, diet, aversion,
      incompatible: allergy.size > 0 || diet.size > 0,
      regime
    };
  }

  return {
    loadProfile,
    classifyIngredient,
    allergyHits,
    dietViolations,
    aversionHits,
    recipeRestrictions,
    getRegime: () => regime
  };
})();

if (typeof window !== "undefined") window.Diet = Diet;
