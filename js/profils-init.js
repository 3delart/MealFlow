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
      "Allergies_JSON": document.getElementById("field-allergies").value,
      "Aversions_JSON": document.getElementById("field-aversions").value
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

document.addEventListener("DOMContentLoaded", function() {
  if (window.UserContext) {
    UserContext.applyUserStyling();
    UserContext.initializeUserToggle();
  }

  setupModalHandlers();
  initializeProfiles();
});
