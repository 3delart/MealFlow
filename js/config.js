/**
 * Centralized categories configuration
 */

const CATEGORIES_CONFIG = [
  { name: "Féculents", expiryDays: 365 },
  { name: "Fromage", expiryDays: 10 },
  { name: "Produits laitiers", expiryDays: 180 },
  { name: "Œufs", expiryDays: 30 },
  { name: "Légumes", expiryDays: 7 },
  { name: "Oignon & Ail", expiryDays: 45 },
  { name: "Fruits", expiryDays: 10 },
  { name: "Herbe aromatique", expiryDays: 5 },
  { name: "Viandes", expiryDays: 3 },
  { name: "Poissons", expiryDays: 2 },
  { name: "Conserves", expiryDays: 365 },
  { name: "Épices & Condiments", expiryDays: 365 },
  { name: "Sauces", expiryDays: 365 },
  { name: "Boissons", expiryDays: 365 },
  { name: "Alcool", expiryDays: 365 },
  { name: "Boulangerie & Viennoiserie", expiryDays: 5 },
  { name: "Pâtisserie", expiryDays: 365 },
  { name: "Goûter", expiryDays: 30 },
  { name: "Surgelés", expiryDays: 365 },
  { name: "Apéro", expiryDays: 120 },
  { name: "Vegan", expiryDays: 15 },
  { name: "Bio", expiryDays: 90 },
  { name: "Cuisine du monde", expiryDays: 365 },
  { name: "Petit déjeuner", expiryDays: 365 },
  { name: "Autres", expiryDays: 30 }
];

// Utility functions
function getCategoryExpiryDays(category) {
  const cat = CATEGORIES_CONFIG.find(c => c.name === category);
  return cat ? cat.expiryDays : 30;
}

function getAllCategoryNames() {
  return CATEGORIES_CONFIG.map(c => c.name);
}

function generateCategoryOptions() {
  return CATEGORIES_CONFIG.map(cat =>
    `<option value="${cat.name}">${cat.name}</option>`
  ).join("");
}

// ============================================================================
// FOOD CLASSIFICATION (allergies + dietary regimes)
// Concepts are accent-free, lowercase tokens (poisson, viande, porc, lait, ...).
// ============================================================================

/** Inventory category → diet/allergy concepts it implies */
const CATEGORY_CONCEPTS = {
  "Poissons": ["poisson"],
  "Viandes": ["viande"],
  "Produits laitiers": ["lait"],
  "Fromage": ["lait"],
  "Œufs": ["oeuf"]
};

/**
 * Concept → keywords matched (as whole words) against an ingredient name.
 * Used when the inventory category is missing (e.g. manual entries like "jarret de porc").
 * Edit freely to add foods you use.
 */
const FOOD_KEYWORDS = {
  // French names + English OFF allergen tokens (en:fish etc.) so the Allergens column auto-classifies
  poisson: ["poisson","cabillaud","saumon","thon","truite","merlu","colin","lieu","sardine","maquereau","hareng","anchois","dorade","sole","limande","raie","lotte","julienne","eglefin","surimi","fish"],
  fruit_de_mer: ["crevette","gambas","moule","huitre","crabe","homard","langoustine","calamar","poulpe","seiche","saint-jacques","bulot","bigorneau","fruit de mer","fruits de mer","crustaceans","molluscs","shellfish"],
  viande: ["boeuf","veau","porc","poulet","dinde","agneau","mouton","canard","lapin","jambon","lardon","lardons","bacon","saucisse","saucisson","chorizo","merguez","steak","escalope","jarret","rumsteck","entrecote","magret","viande","charcuterie","charcute","rillette","boudin","andouille","foie gras","gesier","cochon"],
  porc: ["porc","jambon","lardon","lardons","bacon","saucisson","chorizo","rillette","boudin","andouille","cochon","jarret","echine","couenne","lard","charcute","charcuterie"],
  lait: ["lait","fromage","beurre","creme","yaourt","yogourt","mozzarella","parmesan","parmigiano","gruyere","emmental","cheddar","ricotta","mascarpone","feta","camembert","comte","raclette","reblochon","chevre","brie","burrata","milk"],
  oeuf: ["oeuf","oeufs","mayonnaise","eggs","egg"],
  alcool: ["vin","biere","rhum","whisky","vodka","cognac","alcool","liqueur","champagne","porto","kirsch","calvados","martini","gin"],
  gluten: ["ble","farine","pain","pates","semoule","boulgour","orge","seigle","avoine","chapelure","biscuit","pate brisee","pate feuilletee","gluten","wheat","udon","wrap"]
};

// "animal" = any animal-derived product not covered above (honey, gelatin, ...)
FOOD_KEYWORDS.animal = ["miel","gelatine","gelee royale","propolis","saindoux","presure","cire d'abeille","carmin","isinglass"];

/**
 * Dietary regime → concepts that should raise a warning when present in a recipe.
 * Keys are matched against the profile's Régime case/accent-insensitively.
 * "animal" covers honey/gelatin/etc. for strict vegan.
 */
const DIET_RULES = {
  "vegetarien": ["viande","poisson","fruit_de_mer"],
  "vegan": ["viande","poisson","fruit_de_mer","lait","oeuf","animal"],
  "vegetalien": ["viande","poisson","fruit_de_mer","lait","oeuf","animal"],
  "halal": ["porc","alcool"],
  "casher": ["porc","fruit_de_mer"],
  "kosher": ["porc","fruit_de_mer"],
  "sans gluten": ["gluten"],
  "sans lactose": ["lait"]
};

/**
 * Map free-text allergy labels to internal concepts so e.g. "lactose" flags dairy
 * and "fruits de mer" flags shellfish. Unmapped allergies fall back to text matching.
 */
const ALLERGY_ALIASES = {
  "lactose": "lait",
  "lait": "lait",
  "gluten": "gluten",
  "ble": "gluten",
  "oeuf": "oeuf",
  "oeufs": "oeuf",
  "poisson": "poisson",
  "fruits de mer": "fruit_de_mer",
  "crustaces": "fruit_de_mer",
  "porc": "porc"
};

/** Emoji per food concept, for compact warnings */
const CONCEPT_ICONS = {
  viande: "🥩",
  porc: "🐷",
  poisson: "🐟",
  fruit_de_mer: "🦐",
  lait: "🥛",
  oeuf: "🥚",
  animal: "🍯",
  alcool: "🍷",
  gluten: "🌾"
};

/** Return the emoji for a concept, or a generic warning sign. */
function conceptIcon(concept) {
  return CONCEPT_ICONS[concept] || "⚠️";
}

/** Common allergens offered as multi-select on the profile form */
const ALLERGEN_OPTIONS = [
  "Gluten", "Lactose", "Œuf", "Poisson", "Fruits de mer", "Arachide",
  "Fruits à coque", "Soja", "Céleri", "Moutarde", "Sésame", "Sulfites", "Lupin", "Mollusques"
];

/** Diet/allergen concepts exposed as checkboxes when adding/editing a product */
const DIET_CONCEPTS = [
  { key: "viande", label: "Viande" },
  { key: "porc", label: "Porc" },
  { key: "poisson", label: "Poisson" },
  { key: "fruit_de_mer", label: "Fruits de mer" },
  { key: "lait", label: "Lait / laitier" },
  { key: "oeuf", label: "Œuf" },
  { key: "animal", label: "Autre animal (miel, gélatine…)" },
  { key: "alcool", label: "Alcool" },
  { key: "gluten", label: "Gluten" }
];

/** Normalize for accent/case-insensitive matching (mirror of Utils.normalizeString) */
function _foodNorm(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/**
 * Suggest concept keys for a product from its name, OFF allergens and category.
 * Used to pre-check the inventory checkboxes and as a fallback in recipes.
 * @returns {string[]} concept keys
 */
function suggestDietConcepts(name, allergens, category) {
  const concepts = new Set();
  if (CATEGORY_CONCEPTS[category]) {
    CATEGORY_CONCEPTS[category].forEach(c => concepts.add(c));
  }
  const text = _foodNorm(`${name || ''} ${allergens || ''}`);
  Object.entries(FOOD_KEYWORDS).forEach(([concept, words]) => {
    if (words.some(w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text))) {
      concepts.add(concept);
    }
  });
  // Plant-based products (Vegan category, or a soy/tofu/végétal name) are animal-free by
  // definition: drop animal-origin concepts a misleading name/category might trigger
  // (e.g. plant "lardon", or soy "yaourt" filed under Produits laitiers).
  const isPlantBased = _foodNorm(category) === "vegan" ||
    ["soja", "soy", "sojade", "vegetal", "vegan", "tofu"].some(k => text.includes(k));
  if (isPlantBased) {
    ["viande", "porc", "poisson", "fruit_de_mer", "lait", "oeuf", "animal"].forEach(c => concepts.delete(c));
  }
  return [...concepts];
}

if (typeof window !== 'undefined') {
  window.FoodConfig = { CATEGORY_CONCEPTS, FOOD_KEYWORDS, DIET_RULES, DIET_CONCEPTS, ALLERGEN_OPTIONS, ALLERGY_ALIASES, CONCEPT_ICONS, conceptIcon, suggestDietConcepts };
}
