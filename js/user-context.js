/**
 * User Context Module for MealFlow
 * Manages user toggle between Florian and Naomi
 * Persists user preference to localStorage
 */

const DEFAULT_USER = "florian";
const USERS = ["florian", "naomi"];
const STORAGE_KEY = "mealflow_user";

/**
 * Get current user from localStorage
 * Returns "florian" or "naomi", defaults to "florian" if not set
 * @returns {string} Current user ID
 */
function getCurrentUser() {
  const user = localStorage.getItem(STORAGE_KEY);
  // Any non-empty stored user is valid (profiles are no longer limited to florian/naomi)
  return user && user.trim() ? user : DEFAULT_USER;
}

/**
 * Set current user and persist to localStorage
 * Validates that user is in USERS array
 * Dispatches custom "userChanged" event
 * @param {string} user - User ID to set (must be in USERS array)
 * @throws {Error} If user is not in USERS array
 */
function setCurrentUser(user) {
  if (!user || !user.toString().trim()) {
    throw new Error("Invalid user: must be a non-empty id");
  }
  localStorage.setItem(STORAGE_KEY, user);

  // Dispatch custom event for other parts of the app to listen to
  const event = new CustomEvent("userChanged", {
    detail: { user: user }
  });
  document.dispatchEvent(event);
}

/**
 * Toggle between available users
 * If current user is florian, switches to naomi and vice versa
 */
function toggleUser() {
  const current = getCurrentUser();
  const next = current === "florian" ? "naomi" : "florian";
  setCurrentUser(next);
}

/**
 * Deprecated: profiles are account-driven now, so there is no manual user switcher.
 * Kept as a no-op so existing callers don't break.
 */
function initializeUserToggle() {
  /* no-op */
}

/**
 * Apply user-specific styling based on current user
 * Called on page load to set initial background color
 */
function applyUserStyling() {
  const user = getCurrentUser();
  if (user === "florian") {
    document.body.style.backgroundColor = "var(--color-florian)";
  } else if (user === "naomi") {
    document.body.style.backgroundColor = "var(--color-naomi)";
  }
}

/**
 * Set the current user WITHOUT dispatching userChanged (no side effects/reload).
 * Used during page init where a full render happens anyway.
 */
function setCurrentUserSilent(user) {
  if (user && user.toString().trim()) {
    localStorage.setItem(STORAGE_KEY, user);
  }
}

/**
 * Auto-select the current user by matching the connected Google account email
 * against each profile's Email column. Persists silently (no reload/event).
 * @param {Object.<string,Object>} profilesData - profiles keyed by user id
 * @returns {boolean} true if the current user was changed
 */
function autoSelectProfileByEmail(profilesData) {
  if (typeof getConnectedEmail !== "function" || !profilesData) return false;
  const email = getConnectedEmail();
  if (!email) return false;
  const match = Object.keys(profilesData).find(u => {
    const e = (profilesData[u].Email || "").toString().toLowerCase().trim();
    return e && e === email;
  });
  if (match && getCurrentUser() !== match) {
    localStorage.setItem(STORAGE_KEY, match);
    return true;
  }
  return false;
}

// Export to window for use in other scripts
window.UserContext = {
  getCurrentUser,
  setCurrentUser,
  toggleUser,
  initializeUserToggle,
  applyUserStyling,
  autoSelectProfileByEmail,
  setCurrentUserSilent
};
