/**
 * @fileoverview Accueil — "Manger" modal (log a planned meal as eaten).
 * Extracted from accueil-ui.js. Classic scripts share the top-level scope,
 * so the shared state/helpers declared in accueil-ui.js remain accessible here.
 */

// TASK 4: Manger Modal Functions
function openMangerModal(mealName) {
  const modal = document.getElementById('manger-modal');
  const select = document.getElementById('manger-meal');
  const mealGroup = document.getElementById('manger-meal-group');

  // Find if meal is custom
  const meal = todaysMeals.find(m => m.name === mealName);
  const isCustom = meal && meal.isCustom;

  // Toggle between recipe and custom modes
  const recipeMode = document.getElementById('manger-recipe-mode');
  const customMode = document.getElementById('manger-custom-mode');

  if (isCustom) {
    // Show custom mode
    recipeMode.style.display = 'none';
    customMode.style.display = 'block';
    document.getElementById('manger-custom-name').value = mealName || '';
    document.getElementById('manger-custom-qty').value = '';
    document.getElementById('manger-custom-kcal').value = '';
    document.getElementById('manger-custom-qty').focus();

    // Add event listeners for custom preview updates
    const customQtyInput = document.getElementById('manger-custom-qty');
    const customUnitInput = document.getElementById('manger-custom-unit');
    const customKcalInput = document.getElementById('manger-custom-kcal');

    customQtyInput.removeEventListener('input', updateMangerPreview);
    customUnitInput.removeEventListener('change', updateMangerPreview);
    customKcalInput.removeEventListener('input', updateMangerPreview);

    customQtyInput.addEventListener('input', updateMangerPreview);
    customUnitInput.addEventListener('change', updateMangerPreview);
    customKcalInput.addEventListener('input', updateMangerPreview);
  } else {
    // Show recipe mode
    recipeMode.style.display = 'block';
    customMode.style.display = 'none';

    // Populate from todaysMeals with actual recipe data
    select.innerHTML = '<option value="">-- Sélectionner --</option>';
    const mealsWithRecipes = todaysMeals.filter(m => m.name && m.name.trim());
    mealsWithRecipes.forEach(m => {
      const option = document.createElement('option');
      option.value = m.name;
      option.textContent = `${m.name} (${m.kcal_per_100} kcal/100g)`;
      option.dataset.kcalPer100 = m.kcal_per_100;
      option.dataset.isCustom = m.isCustom || false;

      // Get portion_g from recipesData
      const recipeKey = Object.keys(window.recipesData || {}).find(key =>
        window.recipesData[key].name === m.name
      );
      if (recipeKey) {
        option.dataset.portionG = window.recipesData[recipeKey].portion_g || 0;
      }

      select.appendChild(option);
    });

    // Pre-select meal if passed
    if (mealName) {
      select.value = mealName;
      if (mealGroup) mealGroup.style.display = 'none'; // Hide dropdown, meal already selected
      updateMangerRecipePreview();
    } else {
      if (mealGroup) mealGroup.style.display = 'block';
    }

    document.getElementById('manger-qty').value = '';
    document.getElementById('manger-qty').focus();

    // Add event listeners for recipe preview updates
    select.removeEventListener('change', updateMangerPreview);
    const qtyInput = document.getElementById('manger-qty');
    qtyInput.removeEventListener('input', updateMangerPreview);

    select.addEventListener('change', updateMangerPreview);
    qtyInput.addEventListener('input', updateMangerPreview);
  }

  modal.classList.remove('hidden');
  modal.classList.add('open');
}

function closeMangerModal() {
  const modal = document.getElementById('manger-modal');
  modal.classList.add('hidden');
  modal.classList.remove('open');
  document.getElementById('manger-form').reset();
  document.getElementById('manger-preview').innerHTML = '';
  const mangerUnit = document.getElementById('manger-unit');
  if (mangerUnit) mangerUnit.value = 'portions';
  const mangerQtyLabel = document.getElementById('manger-qty-label');
  if (mangerQtyLabel) mangerQtyLabel.textContent = 'Quantité (portions) :';
  const mealGroup = document.getElementById('manger-meal-group');
  if (mealGroup) mealGroup.style.display = 'block'; // Restore dropdown visibility
  currentResteContext = null;
}

/**
 * Open the Manger modal to eat from a leftover batch.
 * Seeds the recipe dropdown with the single leftover recipe, unit = portions.
 * @param {{recipe:string,row:number,portionG:number,kcal100:number,remaining:number}} ctx
 */
function openResteMangerModal(ctx) {
  currentResteContext = { recipeName: ctx.recipe, rowNumber: ctx.row, portionG: ctx.portionG, kcal100: ctx.kcal100 };

  const modal = document.getElementById('manger-modal');
  document.getElementById('manger-recipe-mode').style.display = 'block';
  document.getElementById('manger-custom-mode').style.display = 'none';

  const select = document.getElementById('manger-meal');
  select.innerHTML = '';
  const option = document.createElement('option');
  option.value = ctx.recipe;
  option.textContent = ctx.recipe;
  option.dataset.kcalPer100 = ctx.kcal100;
  option.dataset.portionG = ctx.portionG;
  option.dataset.isCustom = false;
  select.appendChild(option);
  select.value = ctx.recipe;

  const mealGroup = document.getElementById('manger-meal-group');
  if (mealGroup) mealGroup.style.display = 'none';

  const mangerUnit = document.getElementById('manger-unit');
  if (mangerUnit) mangerUnit.value = 'portions';
  const mangerQtyLabel = document.getElementById('manger-qty-label');
  if (mangerQtyLabel) mangerQtyLabel.textContent = 'Quantité (portions) :';

  const qtyInput = document.getElementById('manger-qty');
  qtyInput.value = '1';
  qtyInput.removeEventListener('input', updateMangerPreview);
  qtyInput.addEventListener('input', updateMangerPreview);
  select.removeEventListener('change', updateMangerPreview);

  updateMangerRecipePreview();

  modal.classList.remove('hidden');
  modal.classList.add('open');
  qtyInput.focus();
}

function updateMangerPreview() {
  // Check which mode is active
  const recipeMode = document.getElementById('manger-recipe-mode');
  const customMode = document.getElementById('manger-custom-mode');

  if (customMode && customMode.style.display !== 'none') {
    updateMangerCustomPreview();
  } else {
    updateMangerRecipePreview();
  }
}

function updateMangerRecipePreview() {
  const mealSelect = document.getElementById('manger-meal');
  const qtyInput = document.getElementById('manger-qty');
  const previewBox = document.getElementById('manger-preview');

  if (!mealSelect.value || !qtyInput.value) {
    previewBox.innerHTML = '';
    return;
  }

  const mealName = mealSelect.value;
  const qty = parseFloat(qtyInput.value);
  const selectedOption = mealSelect.options[mealSelect.selectedIndex];
  const kcalPer100g = parseFloat(selectedOption.dataset.kcalPer100) || 0;

  const unit = document.getElementById('manger-unit')?.value || 'g';
  let qtyGrams, displayLabel;

  if (unit === 'portions') {
    const portionG = parseFloat(selectedOption.dataset.portionG) || 0;
    if (!portionG) {
      previewBox.innerHTML = '<p style="color:orange; padding:8px;">⚠️ Portion non définie pour cette recette</p>';
      return;
    }
    qtyGrams = qty * portionG;
    displayLabel = `${qty} portion${qty > 1 ? 's' : ''} (${Math.round(qtyGrams)}g)`;
  } else {
    qtyGrams = qty;
    displayLabel = `${qty}g`;
  }

  const totalKcal = Math.round(qtyGrams * (kcalPer100g / 100));

  previewBox.innerHTML = `
    <div style="padding: 12px; background-color: var(--color-bg); border-radius: 6px;">
      <p style="margin: 0; font-size: 0.9em;"><strong>${Utils.escapeHTML(mealName)}</strong></p>
      <p style="margin: 4px 0 0 0; font-size: 0.85em; color: var(--color-text-light);">${displayLabel} · ${totalKcal} kcal</p>
    </div>
  `;
}

function updateMangerCustomPreview() {
  const nameInput = document.getElementById('manger-custom-name');
  const qtyInput = document.getElementById('manger-custom-qty');
  const unitInput = document.getElementById('manger-custom-unit');
  const kcalInput = document.getElementById('manger-custom-kcal');
  const previewBox = document.getElementById('manger-preview');

  if (!qtyInput.value || !kcalInput.value) {
    previewBox.innerHTML = '';
    return;
  }

  const mealName = nameInput.value;
  const qty = parseFloat(qtyInput.value);
  const unit = unitInput.value;
  const totalKcal = parseFloat(kcalInput.value);

  previewBox.innerHTML = `
    <div style="padding: 12px; background-color: var(--color-bg); border-radius: 6px;">
      <p style="margin: 0; font-size: 0.9em;"><strong>${Utils.escapeHTML(mealName)}</strong></p>
      <p style="margin: 4px 0 0 0; font-size: 0.85em; color: var(--color-text-light);">${qty}${unit} · ${totalKcal} kcal</p>
    </div>
  `;
}

async function submitManger(e) {
  e.preventDefault();

  // Determine which mode is active
  const customMode = document.getElementById('manger-custom-mode');
  const isCustom = customMode && customMode.style.display !== 'none';

  let mealName, qty, unit, totalKcal, kcalPer100g = null, portionsEaten = 0;

  if (isCustom) {
    // Custom mode
    const nameInput = document.getElementById('manger-custom-name');
    const qtyInput = document.getElementById('manger-custom-qty');
    const unitInput = document.getElementById('manger-custom-unit');
    const kcalInput = document.getElementById('manger-custom-kcal');

    if (!qtyInput.value || !kcalInput.value) {
      alert('Remplissez les champs');
      return;
    }

    mealName = nameInput.value;
    qty = parseFloat(qtyInput.value);
    unit = unitInput.value;
    totalKcal = parseFloat(kcalInput.value);
    kcalPer100g = null; // Custom meals don't have per-100g
  } else {
    // Recipe mode
    const mealSelect = document.getElementById('manger-meal');
    const qtyInput = document.getElementById('manger-qty');

    if (!mealSelect.value || !qtyInput.value) {
      alert('Remplissez les champs');
      return;
    }

    mealName = mealSelect.value;
    qty = parseFloat(qtyInput.value);
    const selectedOption = mealSelect.options[mealSelect.selectedIndex];
    kcalPer100g = parseFloat(selectedOption.dataset.kcalPer100) || 0;

    const unitSelect = document.getElementById('manger-unit')?.value || 'g';
    const portionG = parseFloat(selectedOption.dataset.portionG) || 0;
    let qtyGrams;
    if (unitSelect === 'portions') {
      qtyGrams = qty * portionG;
      unit = 'portion';
    } else {
      qtyGrams = qty;
      unit = 'g';
    }

    // Portions actually eaten (for leftover tracking)
    portionsEaten = unit === 'portion' ? qty : (portionG > 0 ? qty / portionG : 0);

    totalKcal = Math.round(qtyGrams * (kcalPer100g / 100));
  }

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = getTodayISO();
  const user = getCurrentUser();
  const reste = currentResteContext;
  const consType = reste ? 'reste' : 'manger';

  try {
    const token = getAccessToken?.();
    const tabName = `History_${user}`;
    const row = [date, time, mealName, qty, unit, totalKcal, consType];

    // Add to local state (match sheet column names)
    todaysConsumptions.push({ Heure: time, Nom: mealName, Quantité: qty, Unité: unit, Kcal_total: totalKcal, Type: consType });

    // Update global calories consumed
    caloriesConsumed = (caloriesConsumed || 0) + totalKcal;

    // Save to sheet
    if (token && SheetsAPI) {
      await SheetsAPI.appendRowWithToken(tabName, row, token);

      // Leftover tracking (recipe meals only)
      if (!isCustom && portionsEaten > 0 && typeof consumePlannedRecipePortions === 'function') {
        if (reste) {
          await decrementResteBatch(reste.rowNumber, portionsEaten, token);
        } else {
          await consumePlannedRecipePortions(mealName, portionsEaten, token);
        }
        if (typeof renderRestes === 'function') await renderRestes();
      }
    }

    renderConsumptionLog();
    updateProgressDisplay();
    renderWheel();
    closeMangerModal();
    if (window.Toast) Toast.success('Repas enregistré ✓');
  } catch (err) {
    console.error('Error submitting manger:', err);
    if (window.Toast) Toast.error('Échec de la sauvegarde du repas.');
  }
}
