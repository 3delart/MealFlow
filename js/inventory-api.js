/**
 * Open Food Facts API integration for product lookup by barcode
 */

const CATEGORY_MAP = [
  { patterns: ["féculents", "riz", "pâtes", "pain", "pasta", "céréales"], category: "Féculents" },
  { patterns: ["fromage", "comté", "cheddar", "mozzarella", "camembert", "brie", "emmental"], category: "Fromage" },
  { patterns: ["yaourt", "lait", "beurre", "crème", "laitier"], category: "Produits laitiers" },
  { patterns: ["maïs", "légume", "vegetable", "corn", "carotte", "brocoli", "épinard", "poele", "poêle"], category: "Légumes" },
  { patterns: ["fruit", "pomme", "banane", "orange", "raisin"], category: "Fruits" },
  { patterns: ["viande", "meat", "poulet", "boeuf", "porc"], category: "Viandes" },
  { patterns: ["poisson", "fish", "saumon", "trout"], category: "Poissons" },
  { patterns: ["œuf", "egg"], category: "Œufs" },
  { patterns: ["conserve", "canned", "en boîte", "en conserve"], category: "Conserves" },
  { patterns: ["épice", "condiment"], category: "Épices & Condiments" },
  { patterns: ["sauce", "mayonnaise", "ketchup", "moutarde"], category: "Sauces" },
  { patterns: ["boisson", "drink", "jus", "sirop"], category: "Boissons" }
];

async function fetchProductFromOpenFoodFacts(barcode) {
  try {
    console.log("Fetching product for barcode:", barcode);

    const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
    console.log("API URL:", url);

    const response = await fetch(url);
    console.log("API response status:", response.status);

    if (!response.ok) {
      console.warn(`Product not found (${response.status}): ${barcode}`);
      return null;
    }

    const data = await response.json();
    console.log("API response data:", data);

    if (data.status === 0) {
      console.warn(`Product not found (status 0): ${barcode}`);
      return null;
    }

    const product = data.product;
    if (!product) {
      console.warn("No product object in response");
      return null;
    }

    let qty = 1;
    let unit = "pièce";
    const quantityStr = product.quantity || "";

    const match = quantityStr.match(/^([\d.]+)\s*([a-zA-Z]+)$/);
    if (match) {
      qty = parseFloat(match[1]);
      const unitStr = match[2].toLowerCase();
      if (unitStr.includes("ml")) unit = "ml";
      else if (unitStr.includes("l")) unit = "litre";
      else if (unitStr.includes("g")) unit = "g";
      else unit = unitStr;
    }

    let category = "Autres";
    const categoriesStr = product.categories || "";
    const catLower = categoriesStr.toLowerCase();

    for (const map of CATEGORY_MAP) {
      if (map.patterns.some(p => catLower.includes(p))) {
        category = map.category;
        break;
      }
    }

    return {
      name: product.product_name || product.generic_name || "Produit inconnu",
      quantity: qty,
      unit: unit,
      category: category,
      calories: product.nutriments?.["energy-kcal"] || null,
      proteins: product.nutriments?.proteins || null,
      fats: product.nutriments?.fat || null,
      carbs: product.nutriments?.carbohydrates || null,
      allergens: product.allergens_tags ? product.allergens_tags.join(", ") : "Aucune",
      barcode: barcode
    };
  } catch (err) {
    console.error("OpenFoodFacts API error:", err);
    console.error("Error type:", err.constructor.name);
    console.error("Error message:", err.message);
    return null;
  }
}
