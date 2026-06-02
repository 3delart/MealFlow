function setupModalHandlers() {
  const modal = document.getElementById("modal-edit-profile");
  const form = document.getElementById("edit-profile-form");
  const closeBtn = document.querySelector(".modal-close");
  const cancelBtn = document.getElementById("btn-cancel");

  if (!modal || !form) return;

  if (closeBtn) {
    closeBtn.addEventListener("click", closeEditModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", function(e) {
      e.preventDefault();
      closeEditModal();
    });
  }

  modal.addEventListener("click", function(e) {
    if (e.target === modal) {
      closeEditModal();
    }
  });

  form.addEventListener("submit", function(e) {
    e.preventDefault();

    let userId = form.dataset.userId;
    const mode = form.dataset.mode || "edit";

    if (mode === "new" || userId === "new") {
      const prenom = document.getElementById("field-prenom").value.trim();
      if (!prenom) {
        alert("Veuillez entrer un prénom/nom d'utilisateur.");
        return;
      }
      userId = prenom.toLowerCase().split(/\s+/)[0];
    }

    if (!userId) {
      console.error("Form user ID not set");
      return;
    }

    const checkedCuisines = Array.from(document.querySelectorAll('input[name="cuisine-checkbox"]:checked'))
      .map(cb => cb.value);

    const formData = {
      "Prénom": mode === "new" ? document.getElementById("field-prenom").value : (profilesData[userId]?.Prénom || userId),
      "Taille_cm": document.getElementById("field-taille").value,
      "Poids_kg": document.getElementById("field-poids").value,
      "Âge": document.getElementById("field-age").value,
      "Sexe": document.getElementById("field-sexe").value,
      "Activité": document.getElementById("field-activite").value,
      "Objectif": document.getElementById("field-objectif").value,
      "Régime": document.getElementById("field-regime").value,
      "Niveau_culinaire": document.getElementById("field-niveau").value,
      "Durée_max_prep": document.getElementById("field-duree").value,
      "Cuisines_JSON": JSON.stringify(checkedCuisines),
      "Allergies_JSON": getCheckedAllergies().join(", "),
      "Aversions_JSON": getAversions().join(", ")
    };

    if (!formData["Taille_cm"] || !formData["Poids_kg"] || !formData["Âge"] ||
        !formData["Sexe"] || !formData["Activité"] || !formData["Objectif"]) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    const heightCm = parseFloat(formData.Taille_cm);
    const weightKg = parseFloat(formData.Poids_kg);
    const ageYears = parseFloat(formData.Âge);
    const sex = formData.Sexe;
    const activity = formData.Activité;
    const objectif = formData.Objectif;

    const bmr = Utils.calculateBMR(weightKg, heightCm, ageYears, sex);
    const tdee = Utils.calculateTDEE(bmr, activity);
    const caloriesCible = Utils.calculateObjectiveCalories(tdee, objectif);

    formData.Calories_cible = caloriesCible;
    console.log(`Calculated: BMR=${bmr.toFixed(0)}, TDEE=${tdee.toFixed(0)}, Calories_cible=${caloriesCible}`);

    saveProfileData(userId, formData);

    closeEditModal();

    const container = document.getElementById("profiles-container");
    container.innerHTML = "";
    const preferredOrder = ["florian", "naomi"];
    const orderedUsers = preferredOrder.filter(u => profilesData[u]);
    Object.keys(profilesData).forEach(u => {
      if (!orderedUsers.includes(u)) {
        orderedUsers.push(u);
      }
    });
    orderedUsers.forEach(u => {
      const card = renderProfileCard(u);
      if (card) {
        container.appendChild(card);
      }
    });

    const newPrenom = profilesData[userId]["Prénom"] || userId;
  });
}

async function initializeProfiles() {
  const container = document.getElementById("profiles-container");
  if (!container) {
    console.error("Profils: #profiles-container not found in DOM");
    return;
  }

  const loadingEl = document.createElement("p");
  loadingEl.className = "profiles-loading";
  loadingEl.textContent = "Chargement des profils…";
  container.appendChild(loadingEl);

  try {
    await loadProfiles();
  } catch (err) {
    console.error("Profils: unexpected error during load:", err);
    useFallbackProfiles();
  }

  loadProfileOverrides();

  container.innerHTML = "";

  if (Object.keys(profilesData).length === 0) {
    const errorEl = document.createElement("p");
    errorEl.className = "profiles-error";
    errorEl.textContent = "Aucun profil disponible. Vérifiez la configuration des données.";
    container.appendChild(errorEl);
    return;
  }

  const orderedUsers = ["florian", "naomi"];
  orderedUsers.forEach(userId => {
    if (profilesData[userId]) {
      const card = renderProfileCard(userId);
      if (card) {
        container.appendChild(card);
      }
    }
  });

  Object.keys(profilesData).forEach(userId => {
    if (!orderedUsers.includes(userId)) {
      const card = renderProfileCard(userId);
      if (card) {
        container.appendChild(card);
      }
    }
  });
}

// ============================================================================
// Allergies (multi-select) & Aversions (inventory product chips)
// ============================================================================

let _aversionChips = [];

/** Render allergy checkboxes from the predefined list, preserving any custom value. */
function renderAllergyCheckboxes(selected = []) {
  const container = document.getElementById("allergies-checkboxes");
  if (!container) return;
  const opts = (window.FoodConfig && window.FoodConfig.ALLERGEN_OPTIONS) || [];
  const all = [...opts];
  selected.forEach(s => {
    if (s && !all.some(o => o.toLowerCase() === s.toLowerCase())) all.push(s);
  });
  const sel = new Set(selected.map(s => (s || '').toLowerCase()));
  container.innerHTML = "";
  all.forEach(label => {
    const wrap = document.createElement("label");
    wrap.style.cssText = "display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;font-weight:normal;";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = label;
    cb.checked = sel.has(label.toLowerCase());
    wrap.appendChild(cb);
    wrap.appendChild(document.createTextNode(" " + label));
    container.appendChild(wrap);
  });
}

function getCheckedAllergies() {
  return Array.from(document.querySelectorAll('#allergies-checkboxes input[type="checkbox"]:checked'))
    .map(cb => cb.value);
}

function renderAversionChips() {
  const container = document.getElementById("aversion-chips");
  if (!container) return;
  container.innerHTML = "";
  _aversionChips.forEach((name, idx) => {
    const chip = document.createElement("span");
    chip.style.cssText = "display:inline-flex;align-items:center;gap:4px;background:#eee;border-radius:14px;padding:3px 10px;font-size:13px;";
    chip.appendChild(document.createTextNode(name));
    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "×";
    x.style.cssText = "background:none;border:none;cursor:pointer;font-size:16px;line-height:1;color:#888;";
    x.addEventListener("click", () => { _aversionChips.splice(idx, 1); renderAversionChips(); });
    chip.appendChild(x);
    container.appendChild(chip);
  });
}

function addAversion(name) {
  const n = (name || "").trim();
  if (!n) return;
  if (!_aversionChips.some(a => a.toLowerCase() === n.toLowerCase())) {
    _aversionChips.push(n);
    renderAversionChips();
  }
}

function setAversions(list) {
  _aversionChips = Array.isArray(list) ? [...list] : [];
  renderAversionChips();
}

function getAversions() {
  return [..._aversionChips];
}

function initAversionSearch() {
  const input = document.getElementById("aversion-search");
  const dd = document.getElementById("aversion-dropdown");
  if (!input || !dd) return;

  // Conceptual aversions (whole categories) shown first, then matching inventory products
  const conceptLabels = ["Viande", "Porc", "Poisson", "Fruits de mer", "Lait", "Œuf", "Gluten"];

  const render = () => {
    const q = Utils.normalizeString(input.value);
    if (!q) { dd.style.display = "none"; return; }
    const concepts = conceptLabels
      .filter(c => Utils.normalizeString(c).includes(q))
      .map(c => ({ label: c, isConcept: true }));
    const names = [...new Set((window.inventoryData || []).map(i => i.Produit).filter(Boolean))];
    const products = names
      .filter(n => Utils.normalizeString(n).includes(q))
      .map(n => ({ label: n, isConcept: false }));
    const matches = [...concepts, ...products].slice(0, 10);
    if (!matches.length) { dd.style.display = "none"; return; }
    dd.innerHTML = "";
    matches.forEach(({ label, isConcept }) => {
      const div = document.createElement("div");
      div.textContent = isConcept ? `🏷️ ${label} (catégorie)` : label;
      div.style.cssText = "padding:8px 12px;cursor:pointer;font-size:14px;";
      div.addEventListener("mouseover", () => div.style.background = "#f0f0f0");
      div.addEventListener("mouseout", () => div.style.background = "");
      div.addEventListener("click", () => { addAversion(label); input.value = ""; dd.style.display = "none"; });
      dd.appendChild(div);
    });
    dd.style.display = "block";
  };

  input.addEventListener("input", Utils.debounce(render, 200));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addAversion(input.value); input.value = ""; dd.style.display = "none"; }
  });
  document.addEventListener("click", (e) => {
    if (e.target !== input && !dd.contains(e.target)) dd.style.display = "none";
  });
}

document.addEventListener("DOMContentLoaded", function() {
  if (window.UserContext) {
    UserContext.applyUserStyling();
    UserContext.initializeUserToggle();
  }

  setupModalHandlers();
  renderAllergyCheckboxes([]);
  initAversionSearch();
  initializeProfiles();
});
