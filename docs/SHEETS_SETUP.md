# Google Sheets Setup Guide — MealFlow

Configure Google Sheets as backend database for MealFlow with read+write API access.

---

## Step 1: Create Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com)
2. Click **"+ New"** → **"Spreadsheet"**
3. Name it: **`MealFlow-Data`**
4. Copy the **Sheet ID** from URL: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
   - Save this ID — you'll need it later

---

## Step 2: Create Sheet Tabs & Schema

Rename default "Sheet1" and create 5 tabs:

### Tab 1: **Profils**

Header row (row 1):
```
User | Prénom | Taille_cm | Poids_kg | Âge | Sexe | Activité | Objectif | Régime | Allergies_JSON | Aversions_JSON | Cuisines_JSON | Niveau_culinaire | Durée_max_prep | Calories_cible_manuel
```

Example data:
```
florian | Florian | 180 | 75.5 | 32 | M | Modéré | Perte modérée | Omnivore | [] | [] | ["Méditerranéenne","Asiatique"] | Expert | Moyenne |
naomi | Naomi | 165 | 62.0 | 29 | F | Sédentaire | Maintien | Vegan | ["arachides","kiwi"] | ["olives"] | ["Asiatique"] | Intermédiaire | Rapide |
```

---

### Tab 2: **Planning**

Header row (row 1):
```
Date | Jour | Petit-déj | Collation_matin | Déjeuner | Collation_après-midi | Diner
```

Example data (optional — will be auto-generated):
```
2026-05-21 | Mer | Oeufs brouillés | Pomme | Pâtes bolognaise | Yaourt | Salade
```

---

### Tab 3: **Inventory**

Header row (row 1):
```
Produit | Qty | Unité | Catégorie | Date_ajout | Péremption | Consommé | Calories_per_100 | Proteins | Fats | Carbs | Allergens
```

Example data:
```
Tomates Cerises | 400 | g | Légumes | 2026-05-21 | 2026-05-25 | FALSE | 18 | 0.9 | 0.2 | 3.9 | Aucune
Lait | 1 | litre | Produits laitiers | 2026-05-20 | 2026-06-05 | FALSE | 61 | 3.2 | 3.3 | 4.8 | Lait
```

---

### Tab 4: **Courses**

Header row (row 1):
```
Item | Qty | Unité | Prix | Catégorie | Florian_checked | Naomi_checked | Date_création
```

Example data:
```
Pain Complet | 400 | g | 1.80 | Pain | FALSE | FALSE | 2026-05-21
Tomates Cerises | 400 | g | 2.50 | Fruits & Légumes | TRUE | FALSE | 2026-05-20
```

---

### Tab 5: **Recipes**

Header row (row 1):
```
Nom | Calories | Protéines | Lipides | Glucides | Allergènes | Ingrédients | Étapes | Temps_min
```

(Optional — reserved for future recipe database)

---

## Step 3: Set Up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **"Select a Project"** (top-left) → **"NEW PROJECT"**
3. Project name: `MealFlow`
4. Click **"CREATE"**
5. Wait for project to be created, then click **"SELECT PROJECT"**

---

## Step 4: Enable Google Sheets API

1. In Google Cloud Console, search for **"Sheets API"** (top search bar)
2. Click **"Google Sheets API"** from results
3. Click **"ENABLE"**
4. You should see: "✓ API enabled"

---

## Step 5: Create API Key

1. Click **"Create Credentials"** (blue button, top-right)
2. Choose:
   - **Application type:** "Web application" (if asked)
   - Or just click **"API Keys"** if offered directly
3. System creates an **API Key** — copy it immediately
4. Save this key — you'll configure it in MealFlow

---

## Step 6: Share Sheet (Optional but Recommended)

1. Open [sheets.google.com](https://sheets.google.com) → your `MealFlow-Data` sheet
2. Click **"Share"** (top-right)
3. Add email: `floflofloflo35@gmail.com` (Florian)
4. Also add Naomi's email if she has one
5. Both can now edit the sheet

---

## Step 7: Configure MealFlow App

### Option A: Store API Key in localStorage (Development)

1. Open MealFlow in browser: [https://3delart.github.io/MealFlow/](https://3delart.github.io/MealFlow/)
2. Press **F12** → **"Console"** tab
3. Paste this code (replace with YOUR keys):

```javascript
localStorage.setItem("SHEETS_API_KEY", "YOUR_API_KEY_HERE");
localStorage.setItem("SHEETS_ID", "YOUR_SHEET_ID_HERE");
```

4. Press **Enter**
5. Refresh page — app should now read from Sheets

### Option B: Environment Variable (Production)

Create `.env` file in MealFlow repo root:

```
VITE_SHEETS_API_KEY=YOUR_API_KEY_HERE
VITE_SHEETS_ID=YOUR_SHEET_ID_HERE
```

(Requires build step — ask Claude for setup)

---

## Step 8: Test Connection

1. Navigate to any MealFlow page (profils, planning, inventory)
2. Open browser console (F12 → **Console**)
3. Look for messages like:
   - ✓ `"Profils: loaded X profiles from Sheets"`
   - ✓ `"Inventory loaded from Sheets: X items"`
4. If errors:
   - Check API key is correct
   - Check Sheet ID is correct
   - Check Sheets API is enabled in Google Cloud

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **"API request failed with status 400"** | Sheet ID or API key invalid. Double-check both. |
| **"Sheets API is not enabled"** | Go to Google Cloud Console → search Sheets API → ENABLE |
| **"Invalid API key"** | Regenerate key: Google Cloud Console → Credentials → delete old, create new |
| **"Insufficient permissions"** | API key might be read-only. Regenerate with "API Keys" (not OAuth). |
| **Data not syncing** | Refresh page. Check localStorage has correct keys: `localStorage.getItem("SHEETS_API_KEY")` |

---

## API Key Security Notes

⚠️ **Never commit API key to git!**

- Add to `.gitignore`: `SHEETS_API_KEY`, `.env`
- Use localStorage (temporary) or environment variables (production)
- For production, consider:
  - OAuth2 (more secure, user logs in)
  - Backend proxy (API key on server, not exposed)

---

## Next Steps

1. ✓ Create Sheet + tabs + schema
2. ✓ Enable Sheets API in Google Cloud
3. ✓ Generate API key
4. ✓ Configure MealFlow with key
5. ✓ Test connection
6. Generate meals with Claude API (MealFlow will auto-fetch profiles + inventory from Sheets)

---

**Questions?** Check browser console (F12) for detailed error messages.
