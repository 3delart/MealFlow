/**
 * Inventory rendering and display logic
 */

async function reduceQuantity(itemId, currentQty, productName) {
  const currentNum = parseFloat(currentQty) || 0;
  const input = prompt(`Quantité à consommer/supprimer (max ${currentNum}):`);

  if (input === null) return;

  const reduceAmount = parseFloat(input);
  if (isNaN(reduceAmount) || reduceAmount <= 0) {
    alert("Quantité invalide");
    return;
  }

  if (reduceAmount > currentNum) {
    alert(`Quantité trop élevée. Max: ${currentNum}`);
    return;
  }

  const item = inventoryData.find(i => i.id === itemId);
  if (!item) return;

  const token = typeof getAccessToken === 'function' ? getAccessToken() : null;
  try {
    await applyInventoryDeduction(item, reduceAmount, token);
  } catch (err) {
    console.warn(`Failed to update Sheets for item ${itemId}:`, err);
  }

  renderInventory();
}

function renderInventory() {
  const container = document.getElementById("inventory-list");
  if (!container) return;

  const filterEl = document.getElementById("filter-category");
  const filterValue = filterEl ? filterEl.value : "";

  let filtered;
  let expiringSort = false;
  if (filterValue === "__IN_STOCK__") {
    filtered = inventoryData.filter(item => (parseFloat(item.Qty) || 0) > 0);
  } else if (filterValue === "__EXPIRING__") {
    // In-stock items already expired or expiring within 3 days, soonest first
    expiringSort = true;
    filtered = inventoryData.filter(item => {
      if ((parseFloat(item.Qty) || 0) <= 0 || !item.Péremption) return false;
      const d = Utils.daysUntilExpiration(item.Péremption);
      return d < 3;
    });
  } else if (filterValue) {
    filtered = inventoryData.filter(item => item.Catégorie === filterValue);
  } else {
    filtered = inventoryData;
  }

  const searchEl = document.getElementById('search-inventory');
  const searchTerm = searchEl ? searchEl.value.trim() : '';
  if (searchTerm.length >= 1) {
    const norm = s => Utils.normalizeString(s);
    const q = norm(searchTerm);
    filtered = filtered.filter(item => norm(item.Produit).includes(q));
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="inventory-empty">Aucun article</div>';
    return;
  }

  if (expiringSort) {
    // Soonest-to-expire first (already-expired items sort to the very top)
    filtered.sort((a, b) =>
      Utils.daysUntilExpiration(a.Péremption) - Utils.daysUntilExpiration(b.Péremption));
  } else {
    filtered.sort((a, b) => {
      if (a.Catégorie !== b.Catégorie) {
        return a.Catégorie.localeCompare(b.Catégorie, 'fr');
      }
      return a.Produit.localeCompare(b.Produit, 'fr');
    });
  }

  container.innerHTML = "";
  let currentCategory = null;

  filtered.forEach(item => {
    // In the expiry view, list by urgency without category headers
    if (!expiringSort && item.Catégorie !== currentCategory) {
      currentCategory = item.Catégorie;
      const catHeader = document.createElement("div");
      catHeader.className = "category-header";
      catHeader.textContent = currentCategory;
      container.appendChild(catHeader);
    }

    const itemEl = createInventoryItemElement(item);
    container.appendChild(itemEl);
  });
}

function createInventoryItemElement(item) {
  const div = document.createElement("div");
  div.className = "inventory-item";

  const expiryDate = new Date(item.Péremption);
  const today = new Date();
  const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    div.classList.add("expired");
  } else if (daysLeft <= 3) {
    div.classList.add("expiring-soon");
  }

  const headerDiv = document.createElement("div");
  headerDiv.className = "inventory-item-header";

  const nameH3 = document.createElement("h3");
  nameH3.className = "inventory-item-name";
  nameH3.textContent = item.Produit;

  const priceSpan = document.createElement("span");
  priceSpan.className = "inventory-item-price";
  priceSpan.textContent = item.Prix ? `${item.Prix}€` : "—";

  headerDiv.appendChild(nameH3);
  headerDiv.appendChild(priceSpan);

  const contentDiv = document.createElement("div");
  contentDiv.className = "inventory-item-content";

  const qtyDiv = document.createElement("div");
  qtyDiv.className = "inventory-item-stat";
  const qtyLabel = document.createElement("span");
  qtyLabel.className = "stat-label";
  qtyLabel.textContent = "Quantité";
  const qtyValue = document.createElement("span");
  qtyValue.className = "stat-value";
  qtyValue.textContent = `${item.Qty} ${item.Unité}`;
  qtyDiv.appendChild(qtyLabel);
  qtyDiv.appendChild(qtyValue);
  contentDiv.appendChild(qtyDiv);

  if (item.calories_per_100) {
    const calDiv = document.createElement("div");
    calDiv.className = "inventory-item-stat";
    const calLabel = document.createElement("span");
    calLabel.className = "stat-label";
    calLabel.textContent = "Calories/100g";
    const calValue = document.createElement("span");
    calValue.className = "stat-value";
    calValue.textContent = item.calories_per_100.toFixed(0) + " kcal";
    calDiv.appendChild(calLabel);
    calDiv.appendChild(calValue);
    contentDiv.appendChild(calDiv);
  }

  const expiryDiv = document.createElement("div");
  expiryDiv.className = "inventory-item-expiry";
  if (daysLeft < 0) {
    expiryDiv.classList.add("expired");
    expiryDiv.textContent = "❌ Expiré";
  } else if (daysLeft <= 3) {
    expiryDiv.classList.add("expiring");
    expiryDiv.textContent = `⚠️ ${daysLeft} jour(s) restant(s)`;
  } else {
    expiryDiv.textContent = `📅 ${Utils.formatDate(item.Péremption)}`;
  }

  if (item.allergens && item.allergens !== "—") {
    const allergyDiv = document.createElement("div");
    allergyDiv.className = "inventory-item-stat";
    const allergyLabel = document.createElement("span");
    allergyLabel.className = "stat-label";
    allergyLabel.textContent = "Allergènes";
    const allergyValue = document.createElement("span");
    allergyValue.className = "stat-value";
    allergyValue.textContent = item.allergens;
    allergyDiv.appendChild(allergyLabel);
    allergyDiv.appendChild(allergyValue);
    contentDiv.appendChild(allergyDiv);
  }

  const mainDiv = document.createElement("div");
  mainDiv.appendChild(headerDiv);
  mainDiv.appendChild(contentDiv);
  mainDiv.appendChild(expiryDiv);

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "inventory-item-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "btn-edit";
  editBtn.textContent = "✏️ Corriger";
  editBtn.addEventListener("click", () => openEditModal(item));

  const consumeBtn = document.createElement("button");
  consumeBtn.className = "btn-consume";
  consumeBtn.textContent = "✓ Consommer/Supprimer";
  consumeBtn.addEventListener("click", () => reduceQuantity(item.id, item.Qty, item.Produit));

  actionsDiv.appendChild(editBtn);
  actionsDiv.appendChild(consumeBtn);

  div.appendChild(mainDiv);
  div.appendChild(actionsDiv);

  return div;
}
