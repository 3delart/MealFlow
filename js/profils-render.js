function fmt(val, unit = "", decimals = 0) {
  if (isNaN(val) || val === null || val === undefined) return "—";
  return val.toFixed(decimals) + (unit ? " " + unit : "");
}

function imcLabel(imc) {
  if (isNaN(imc)) return "";
  if (imc < 18.5) return "Sous-poids";
  if (imc < 25)   return "Normal";
  if (imc < 30)   return "Surpoids";
  return "Obésité";
}

function createStatItem(label, value, subvalue = "") {
  const item = document.createElement("div");
  item.className = "stat-item";

  const lbl = document.createElement("span");
  lbl.className = "stat-label";
  lbl.textContent = label;

  const val = document.createElement("span");
  val.className = "stat-value";
  val.textContent = value;

  item.appendChild(lbl);
  item.appendChild(val);

  if (subvalue) {
    const sub = document.createElement("span");
    sub.className = "stat-subvalue";
    sub.textContent = subvalue;
    item.appendChild(sub);
  }

  return item;
}

function createSection(title, content) {
  const section = document.createElement("div");
  section.className = "profile-section";

  const heading = document.createElement("p");
  heading.className = "profile-section-title";
  heading.textContent = title;

  section.appendChild(heading);
  section.appendChild(content);
  return section;
}

function createTagList(items) {
  if (!items || items.length === 0) {
    const empty = document.createElement("span");
    empty.className = "tag-empty";
    empty.textContent = "Aucune";
    return empty;
  }

  const ul = document.createElement("ul");
  ul.className = "tag-list";
  items.forEach(item => {
    const li = document.createElement("li");
    li.className = "tag";
    li.textContent = item;
    ul.appendChild(li);
  });
  return ul;
}

function renderProfileCard(userId) {
  const profile = profilesData[userId];
  if (!profile) {
    console.warn("Profils: no profile found for user:", userId);
    return null;
  }

  const metrics = calculateProfileMetrics(profile);
  const { bmr, tdee, calorieTarget, imc } = metrics;

  const allergies = parseArrayField(profile["Allergies_JSON"]);
  const aversions = parseArrayField(profile["Aversions_JSON"]);
  const cuisines  = parseArrayField(profile["Cuisines_JSON"]);

  const prenom     = profile["Prénom"] || userId;
  const regime     = profile["Régime"] || "—";
  const activite   = profile["Activité"] || "—";
  const objectif   = profile["Objectif"] || "—";
  const niveauCulinaire = profile["Niveau_culinaire"] || "—";
  const dureePrep  = profile["Durée_max_prep"] || "—";
  const taille     = profile["Taille_cm"] || "—";
  const poids      = profile["Poids_kg"] || "—";
  const age        = profile["Âge"] || "—";
  const sexe       = profile["Sexe"] || "—";

  const card = document.createElement("div");
  card.className = `profile-card ${userId}`;
  card.setAttribute("data-user", userId);

  const header = document.createElement("div");
  header.className = "profile-header";

  const headerTop = document.createElement("div");
  headerTop.className = "profile-header-top";

  const avatarEl = document.createElement("span");
  avatarEl.className = "profile-avatar";
  avatarEl.textContent = profile["Sexe"] === "F" ? "👩" : "👨";

  const regimeBadge = document.createElement("span");
  regimeBadge.className = "regime-badge";
  regimeBadge.textContent = "Régime : " + regime;

  headerTop.appendChild(avatarEl);
  headerTop.appendChild(regimeBadge);

  const nameEl = document.createElement("h2");
  nameEl.className = "profile-name";
  nameEl.textContent = prenom;

  header.appendChild(headerTop);
  header.appendChild(nameEl);
  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "profile-body";

  const measureGroup = document.createElement("div");
  measureGroup.className = "stat-group four-col";
  measureGroup.appendChild(createStatItem("Taille", taille !== "—" ? taille + " cm" : "—"));
  measureGroup.appendChild(createStatItem("Poids", poids !== "—" ? poids + " kg" : "—"));
  measureGroup.appendChild(createStatItem("IMC", fmt(imc, "", 1), imcLabel(imc)));
  measureGroup.appendChild(createStatItem("Âge", age !== "—" ? age + " ans" : "—", "Sexe : " + sexe));
  body.appendChild(createSection("Mensurations", measureGroup));

  const metaGroup = document.createElement("div");
  metaGroup.className = "stat-group";
  metaGroup.appendChild(createStatItem("BMR", fmt(bmr, "kcal"), "Métabolisme de base"));
  metaGroup.appendChild(createStatItem("TDEE", fmt(tdee, "kcal"), "Dépense totale"));
  metaGroup.appendChild(createStatItem("Activité", activite));
  body.appendChild(createSection("Métabolisme", metaGroup));

  const objGroup = document.createElement("div");
  objGroup.className = "stat-group";
  objGroup.appendChild(createStatItem("Objectif de base", objectif));
  objGroup.appendChild(createStatItem("Cible quotidienne", fmt(calorieTarget, "kcal")));
  body.appendChild(createSection("Objectif", objGroup));

  const prefGroup = document.createElement("div");
  prefGroup.className = "stat-group";
  prefGroup.appendChild(createStatItem("Niveau culinaire", niveauCulinaire));
  prefGroup.appendChild(createStatItem("Durée max prépa", dureePrep));

  const cuisineWrap = document.createElement("div");
  cuisineWrap.style.gridColumn = "1 / -1";
  const cuisineLabel = document.createElement("span");
  cuisineLabel.className = "stat-label";
  cuisineLabel.textContent = "Cuisines préférées";
  cuisineWrap.appendChild(cuisineLabel);
  cuisineWrap.appendChild(createTagList(cuisines));
  prefGroup.appendChild(cuisineWrap);

  body.appendChild(createSection("Préférences", prefGroup));

  const restrGroup = document.createElement("div");
  restrGroup.className = "stat-group";

  const allergiesWrap = document.createElement("div");
  const allergiesLabel = document.createElement("span");
  allergiesLabel.className = "stat-label";
  allergiesLabel.textContent = "Allergies";
  allergiesWrap.appendChild(allergiesLabel);
  allergiesWrap.appendChild(createTagList(allergies));
  restrGroup.appendChild(allergiesWrap);

  const aversionsWrap = document.createElement("div");
  const aversionsLabel = document.createElement("span");
  aversionsLabel.className = "stat-label";
  aversionsLabel.textContent = "Aversions";
  aversionsWrap.appendChild(aversionsLabel);
  aversionsWrap.appendChild(createTagList(aversions));
  restrGroup.appendChild(aversionsWrap);

  body.appendChild(createSection("Restrictions alimentaires", restrGroup));

  card.appendChild(body);

  const footer = document.createElement("div");
  footer.className = "profile-footer";

  // Only the connected account's own profile (matched by email) is editable
  if (userId === window._ownProfileId) {
    const editBtn = document.createElement("button");
    editBtn.className = "btn-edit-profile";
    editBtn.textContent = "✏️ Modifier";
    editBtn.addEventListener("click", function() {
      openEditModal(userId);
    });
    footer.appendChild(editBtn);
  }

  const histBtn = document.createElement("button");
  histBtn.className = "btn-profile-action";
  histBtn.textContent = "📋 Historique";
  histBtn.addEventListener("click", () => openHistoryModal(userId));

  const statsBtn = document.createElement("button");
  statsBtn.className = "btn-profile-action";
  statsBtn.textContent = "📊 Stats";
  statsBtn.addEventListener("click", () => openStatsModal(userId));

  footer.appendChild(histBtn);
  footer.appendChild(statsBtn);
  card.appendChild(footer);

  return card;
}
