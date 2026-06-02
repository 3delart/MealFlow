/**
 * Centralized categories configuration
 */

const CATEGORIES_CONFIG = [
  { name: "Féculents", expiryDays: 730 },
  { name: "Fromage", expiryDays: 60 },
  { name: "Produits laitiers", expiryDays: 180 },
  { name: "Œufs", expiryDays: 30 },
  { name: "Légumes", expiryDays: 7 },
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
  { name: "Surgelés", expiryDays: 180 },
  { name: "Apéro", expiryDays: 30 },
  { name: "Vegan", expiryDays: 30 },
  { name: "Bio", expiryDays: 30 },
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
