async function regenerateMeals() {
  const btn = document.getElementById("regenerate-meals-btn");
  if (!btn) return;

  if (!isAuthenticated()) {
    alert("Connecte-toi avec Google d'abord");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Génération en cours...";

  try {
    const response = await fetch(
      "https://api.github.com/repos/3delart/MealFlow/actions/workflows/generate-meals.yml/dispatches",
      {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github.v3+raw+json"
        },
        body: JSON.stringify({ ref: "main" })
      }
    );

    if (response.status === 204 || response.ok) {
      btn.textContent = "✓ Lancé! (1-2 min)";
      console.log("✓ Workflow triggered");
      setTimeout(() => location.reload(), 3000);
    } else {
      throw new Error(`GitHub API ${response.status}`);
    }
  } catch (error) {
    console.error("Failed:", error);
    btn.disabled = false;
    btn.textContent = "🤖 Régénérer semaine";
    alert(`Erreur: ${error.message}\n\nNote: Pas besoin de token pour déclencher via GitHub Pages en dev`);
  }
}
