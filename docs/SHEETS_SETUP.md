# Google Sheets Setup

## Create Sheet

1. Go to [Google Sheets](https://sheets.google.com) and click "Create" → "Blank spreadsheet"
2. Name your sheet "MealFlow"
3. Create 5 tabs by right-clicking the sheet tab at the bottom:
   - **Recipes** — Store recipe names, ingredients, nutrition info
   - **Inventory** — Track pantry/fridge items and quantities
   - **Planning** — Weekly meal plan calendar
   - **Nutrition** — Aggregate nutrition data for meals
   - **Users** — List of app users (Florian, Naomi, etc.)
4. Add headers to each tab (e.g., "Name", "Quantity", "Date")
5. Customize columns based on your tracking needs

## Get API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Search for "Google Sheets API" and enable it
4. Go to "Credentials" and create a new API Key (or Service Account key)
5. Copy your API Key and store it securely (you'll need this for the app)

## Share Sheet

1. Click the "Share" button in your Google Sheet
2. Add collaborators: `floflofloflo35@gmail.com` (Florian) and the email for Naomi
3. Set permission level to "Editor" for both users
4. Uncheck "Notify people" if preferred

## Get Sheet ID

1. Open your Google Sheet in a browser
2. Look at the URL: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`
3. Copy the `SHEET_ID` portion (long alphanumeric string)
4. Store this in your app configuration (you'll reference it in code)
