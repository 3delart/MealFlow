/**
 * @fileoverview Profile guard. If the connected Google account has no matching
 * profile (by Email), redirect to profils.html so they can create one.
 * Runs on every page except profils.html itself. Does nothing when not logged in
 * (the auth gate handles that case).
 */
(function () {
  async function guard() {
    if (typeof isAuthenticated !== "function" || !isAuthenticated()) return;

    const path = (location.pathname || "").toLowerCase();
    if (path.endsWith("profils.html")) return; // creation page — never redirect away

    if (!window.SheetsAPI || typeof getConnectedEmail !== "function") return;
    const email = getConnectedEmail();
    if (!email) return; // can't determine the account — don't block

    try {
      const rows = await SheetsAPI.readSheetTab("Profils");
      const objects = SheetsAPI.rowsToObjects(rows);
      const match = objects.find(
        o => (o.Email || "").toString().toLowerCase().trim() === email
      );
      if (!match) {
        window.location.replace("profils.html");
      }
    } catch (err) {
      // Network/Sheets error — don't lock the user out
      console.warn("Profile guard skipped:", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", guard);
  } else {
    guard();
  }
})();
