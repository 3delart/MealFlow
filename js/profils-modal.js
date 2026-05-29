function openNewProfileModal() {
  const form = document.getElementById("edit-profile-form");

  form.reset();
  form.dataset.userId = "new";
  form.dataset.mode = "new";

  document.querySelectorAll('input[name="cuisine-checkbox"]').forEach(cb => cb.checked = false);

  const premomGroup = document.getElementById("field-prenom-group");
  if (premomGroup) premomGroup.style.display = "block";
  const premomInput = document.getElementById("field-prenom");
  if (premomInput) premomInput.required = true;

  document.getElementById("modal-title").textContent = "Ajouter un profil";

  const modal = document.getElementById("modal-edit-profile");
  modal.classList.add("open");
}

function openEditModal(userId) {
  const profile = profilesData[userId];
  if (!profile) {
    console.error("Profile not found for user:", userId);
    return;
  }

  const modal = document.getElementById("modal-edit-profile");
  const form = document.getElementById("edit-profile-form");
  const title = document.getElementById("modal-title");

  const prenom = profile["Prénom"] || userId;
  title.textContent = `Modification du profil de ${prenom}`;

  document.getElementById("field-taille").value = profile["Taille_cm"] || "";
  document.getElementById("field-poids").value = profile["Poids_kg"] || "";
  document.getElementById("field-age").value = profile["Âge"] || "";
  document.getElementById("field-sexe").value = profile["Sexe"] || "";
  document.getElementById("field-activite").value = profile["Activité"] || "";
  document.getElementById("field-objectif").value = profile["Objectif"] || "";
  document.getElementById("field-regime").value = profile["Régime"] || "";
  document.getElementById("field-niveau").value = profile["Niveau_culinaire"] || "";
  document.getElementById("field-duree").value = profile["Durée_max_prep"] || "";

  const premomGroup = document.getElementById("field-prenom-group");
  if (premomGroup) premomGroup.style.display = "none";
  const premomInput = document.getElementById("field-prenom");
  if (premomInput) premomInput.required = false;

  const cuisines = parseArrayField(profile["Cuisines_JSON"]);
  const cuisineCheckboxes = document.querySelectorAll('input[name="cuisine-checkbox"]');
  cuisineCheckboxes.forEach(cb => {
    cb.checked = cuisines.includes(cb.value);
  });

  const allergies = parseArrayField(profile["Allergies_JSON"]);
  document.getElementById("field-allergies").value = allergies.join(", ");

  const aversions = parseArrayField(profile["Aversions_JSON"]);
  document.getElementById("field-aversions").value = aversions.join(", ");

  form.dataset.userId = userId;
  form.dataset.mode = "edit";

  modal.classList.add("open");
}

function closeEditModal() {
  const modal = document.getElementById("modal-edit-profile");
  modal.classList.remove("open");
}
