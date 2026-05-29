function parseNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? NaN : n;
}

function parseArrayField(val) {
  if (!val || val.trim() === "") return [];
  const trimmed = val.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (_) {
      // fall through
    }
  }
  return trimmed.split(",").map(s => s.trim()).filter(Boolean);
}

function calculateProfileMetrics(profile) {
  const weight = parseNum(profile["Poids_kg"]);
  const height = parseNum(profile["Taille_cm"]);
  const age    = parseNum(profile["Âge"]);
  const sex    = (profile["Sexe"] || "").trim();
  const activity = (profile["Activité"] || "Sédentaire").trim();
  const objectif = (profile["Objectif"] || "Maintien").trim();

  let bmr = NaN;
  let tdee = NaN;
  let calorieTarget = NaN;
  let imc = NaN;

  if (!isNaN(weight) && !isNaN(height) && !isNaN(age) && sex) {
    bmr = Utils.calculateBMR(weight, height, age, sex);
    tdee = Utils.calculateTDEE(bmr, activity);
    calorieTarget = Utils.calculateObjectiveCalories(tdee, objectif);
    imc = weight / Math.pow(height / 100, 2);
  }

  return { bmr, tdee, calorieTarget, imc };
}
