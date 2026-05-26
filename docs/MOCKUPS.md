# MealFlow V2 — Page Mockups

---

## 1. ACCUEIL (index.html)

```
┌─────────────────────────────────┐
│  Bonjour Florian                │
│  lundi 26 mai 2026              │
│              [F]                │  ← user chip
└─────────────────────────────────┘

        ╭─────────────────╮
        │       50%       │
        │    ◯ ◯ ◯ ◯ ◯   │
        │   ◯ ◯ ◯ ◯ ◯ ◯  │
        │  ◯ ◯ ◯ 50% ◯ ◯ │
        │   ◯ ◯ ◯ ◯ ◯ ◯  │
        │    ◯ ◯ ◯ ◯ ◯   │
        │  1200 / 2200    │
        │    kcal         │
        ╰─────────────────╯

┌─────────────────────────────────┐
│ Journal du jour                 │
├─────────────────────────────────┤
│ 🍽️  Pâtes Carbonara     12:30   │
│    250g · 450 kcal             │
│                                │
│ 🥗 Salade Verte         14:15   │
│    150g · 45 kcal              │
│                                │
│ 🥤 Jus d'Orange         15:00   │
│    250ml · 112 kcal            │
└─────────────────────────────────┘

    ┌───────────────────────────┐
    │   🍴 J'ai mangé          │
    └───────────────────────────┘

        ┌──────────────────┐
        │ 🏠 Accueil       │
        │ 📖 Recettes      │
        │ 📅 Planning      │
        │ 📦 Inventaire    │
        │ 👤 Profils       │
        └──────────────────┘
```

### Modal "J'ai mangé"

```
╔═════════════════════════════════╗
║ J'ai mangé                  ✕   ║
╠═════════════════════════════════╣
║                                 ║
║ [📱 Scanner un produit]         ║
║ [📖 Choisir une recette]        ║
║ [📦 Chercher dans l'inventaire] ║
║ [✏️  Saisie manuelle]           ║
║                                 ║
╟─────────────────────────────────╢
║ Quantité (grammes)              ║
║ [______________]                ║
║                                 ║
║ [Ajouter au journal] [Annuler]  ║
║                                 ║
╚═════════════════════════════════╝
```

---

## 2. RECETTES (recettes.html)

```
┌─────────────────────────────────┐
│ 📖 Recettes                      │
│              [F]                │
└─────────────────────────────────┘

  Rechercher... [_________________]

┌─────────────────────────────────┐
│ ➕ Ajouter une recette          │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Pâtes Carbonara                 │
│ ⏱️  20 min | 🍽️  2 portions    │
│ 180 kcal/100g                   │
│ [rapide] [omnivore]             │
│ 3 ingrédients                   │
│                          ▼ clic  │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Salade Niçoise                  │
│ ⏱️  15 min | 🍽️  4 portions    │
│ 95 kcal/100g                    │
│ [végétarien]                    │
│ 6 ingrédients                   │
│                          ▼ clic  │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Omelette Fromage                │
│ ⏱️  10 min | 🍽️  1 portion     │
│ 155 kcal/100g                   │
│ [rapide] [omnivore]             │
│ 4 ingrédients                   │
│                          ▼ clic  │
└─────────────────────────────────┘

        ┌──────────────────┐
        │ 🏠 📖 📅 📦 👤  │
        └──────────────────┘
```

### Modal "Ajouter/Éditer Recette"

```
╔═════════════════════════════════╗
║ Ajouter une recette         ✕   ║
╠═════════════════════════════════╣
║ Nom                             ║
║ [_________________]             ║
║                                 ║
║ Temps de prep (min)             ║
║ [____]                          ║
║                                 ║
║ Portions                        ║
║ [____]                          ║
║                                 ║
║ Tags:                           ║
║ [✓ rapide] [végétarien]        ║
║ [vegan] [omnivore]              ║
║ [sans gluten]                   ║
║                                 ║
║ Ingrédients                     ║
║ [Pâtes] [400] [g] [✕]          ║
║ [Œufs] [3] [pièce] [✕]         ║
║ [+ Ajouter ingrédient]          ║
║                                 ║
║ Étapes                          ║
║ [Cuire les pâtes....] [✕]      ║
║ [Mélanger avec les œufs] [✕]   ║
║ [+ Ajouter étape]               ║
║                                 ║
║ [Sauvegarder] [Annuler]         ║
║                                 ║
╚═════════════════════════════════╝
```

### Modal "Détail Recette"

```
╔═════════════════════════════════╗
║ Pâtes Carbonara             ✕   ║
╠═════════════════════════════════╣
║ ⏱️  20 min | 🍽️  2 portions    ║
║ 180 kcal/100g                   ║
║                                 ║
║ Ingrédients:                    ║
║ • 400g — Pâtes                  ║
║ • 3 pièce — Œufs                ║
║ • 150g — Lardons                ║
║                                 ║
║ Étapes:                         ║
║ 1. Cuire les pâtes              ║
║ 2. Faire revenir les lardons    ║
║ 3. Mélanger avec les œufs       ║
║                                 ║
║ [✏️  Éditer] [🗑️  Supprimer]   ║
║ [Fermer]                        ║
║                                 ║
╚═════════════════════════════════╝
```

---

## 3. PLANNING (planning.html)

```
┌─────────────────────────────────┐
│ 📅 Planning                      │
│              [F]                │
└─────────────────────────────────┘

  [◀ Préc.] Sem 22 (25-31 mai) [Suiv. ▶]

┌──────────────────────────────────┐
│ LUNDI 25                         │
├──────────────┬──────────────────┤
│ Midi:        │ Soir:            │
│ Pâtes Carb.  │ [Tap pour ajouter]
│ (2 portions) │                  │
├──────────────┼──────────────────┤
│ MARDI 26                         │
├──────────────┬──────────────────┤
│ Midi:        │ Soir:            │
│ Salade       │ Omelette         │
│ (4 portions) │ (1 portion)      │
├──────────────┼──────────────────┤
│ MERCREDI 27                      │
├──────────────┬──────────────────┤
│ Midi:        │ Soir:            │
│ [empty]      │ [empty]          │
├──────────────┼──────────────────┤
│ ... (suite)                      │
└──────────────────────────────────┘

┌─────────────────────────────────┐
│ 🛒 Générer liste de courses    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 👁️  Recette du jour             │
└─────────────────────────────────┘

        ┌──────────────────┐
        │ 🏠 📖 📅 📦 👤  │
        └──────────────────┘
```

### Modal "Choisir une recette"

```
╔═════════════════════════════════╗
║ Recettes                    ✕   ║
╠═════════════════════════════════╣
║ Rechercher... [_____________]   ║
║                                 ║
║ ☐ Pâtes Carbonara               ║
║   180 kcal/100g                 ║
║                                 ║
║ ☐ Salade Niçoise                ║
║   95 kcal/100g                  ║
║                                 ║
║ ☐ Omelette Fromage              ║
║   155 kcal/100g                 ║
║                                 ║
║ ☐ Ratatouille                   ║
║   85 kcal/100g                  ║
║                                 ║
╚═════════════════════════════════╝
```

---

## 4. RECETTE DU JOUR (recette_du_jour.html)

```
┌─────────────────────────────────┐
│ 🍽️  Recette du jour             │
│              [F]                │
└─────────────────────────────────┘

        ┌─────────────────┐
        │ MARDI 26 mai    │
        │                 │
        │ Pâtes Carbonara │
        │                 │
        │ ⏱️  20 min      │
        │ 🍽️  2 portions │
        │                 │
        │ 180 kcal/100g   │
        └─────────────────┘

┌─────────────────────────────────┐
│ Ingrédients                     │
├─────────────────────────────────┤
│ • 400g — Pâtes                  │
│ • 3 pièces — Œufs               │
│ • 150g — Lardons                │
│ • 100g — Crème fraîche          │
│ • 1 — Oignon                    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Étapes de Préparation           │
├─────────────────────────────────┤
│ 1. Cuire les pâtes              │
│ 2. Faire revenir les lardons    │
│ 3. Émincer l'oignon             │
│ 4. Mélanger les œufs avec la    │
│    crème fraîche                │
│ 5. Incorporer les pâtes         │
│ 6. Assaisonner et servir        │
└─────────────────────────────────┘

        ┌──────────────────┐
        │ 🏠 📖 📅 📦 👤  │
        └──────────────────┘
```

---

## 5. INVENTAIRE (inventory.html)

```
┌─────────────────────────────────┐
│ 📦 Inventaire                    │
│              [F]                │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Catégorie: [Tous ▼]             │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ [📱 Scanner un Produit]         │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Tomates Cerises                 │
│ 250g · expire dans 3 jours ⚠️   │
│ 18 kcal/100g · 2,50 EUR         │
│ [Consommer] [Éditer] [🗑️]     │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Œufs Bio                        │
│ 12 pièces · expire dans 15 j    │
│ 155 kcal/100g · 4,50 EUR        │
│ [Consommer] [Éditer] [🗑️]     │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Lardons Fumés                   │
│ 200g · EXPIRÉ hier ❌           │
│ 375 kcal/100g · 3,20 EUR        │
│ [Consommer] [Éditer] [🗑️]     │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Crème Fraîche                   │
│ 400ml · expire dans 5 jours     │
│ 340 kcal/100ml · 2,00 EUR       │
│ [Consommer] [Éditer] [🗑️]     │
└─────────────────────────────────┘

        ┌──────────────────┐
        │ 🏠 📖 📅 📦 👤  │
        └──────────────────┘
```

### Modal "Ajouter Article"

```
╔═════════════════════════════════╗
║ Ajouter Article             ✕   ║
╠═════════════════════════════════╣
║ Produit                         ║
║ [Œufs]                          ║
║                                 ║
║ Quantité  [6]                   ║
║ Unité     [pièce ▼]             ║
║                                 ║
║ Catégorie [Produits laitiers ▼] ║
║                                 ║
║ Date d'expiration [2026-06-15]  ║
║                                 ║
║ Prix (EUR) [4.50]               ║
║                                 ║
║ Kcal/100   [155]                ║
║ (auto-rempli)                   ║
║                                 ║
║ [Ajouter] [Annuler]             ║
║                                 ║
╚═════════════════════════════════╝
```

---

## 6. PROFILS (profils.html)

```
┌─────────────────────────────────┐
│ 👤 Profils                       │
│              [F]                │
└─────────────────────────────────┘

        [Profil] [Historique] [Stats]

        ─── TAB: Profil ───

┌─────────────────────────────────┐
│ Florian                         │
│                                 │
│ Taille: 175 cm   |  Poids: 75kg │
│ IMC: 24.5        |  BMR: 1800   │
│ TDEE: 2700       |  Objectif:   │
│ 2200 kcal        |              │
│ Régime: Omnivore                │
└─────────────────────────────────┘

        [✏️  Éditer Profil]

        ─── TAB: Historique ───

┌─────────────────────────────────┐
│ Lundi 26 mai 2026               │
│ 1346 kcal ────────► [Détails]   │
│                                 │
│ Dimanche 25 mai 2026            │
│ 1890 kcal (↑ objectif) ─► [Det] │
│                                 │
│ Samedi 24 mai 2026              │
│ 2100 kcal ────────► [Détails]   │
│                                 │
│ Vendredi 23 mai 2026            │
│ 1750 kcal ────────► [Détails]   │
│                                 │
│ Jeudi 22 mai 2026               │
│ 2450 kcal (↑ objectif) ─► [Det] │
│                                 │
└─────────────────────────────────┘

        ─── TAB: Stats ───

┌─────────────────────────────────┐
│ Moyenne 7j: 1900 kcal           │
│ Poids: 75.2 kg (↑ 0.2kg)        │
│ Différence: -500 kcal/jour      │
└─────────────────────────────────┘

   [Graphique: 30 jours kcal]
   (Chart.js line chart)
   
   [Graphique: 30 jours poids]
   (Chart.js line chart)

   Poids actuel (kg) [___]
   [OK]

        ┌──────────────────┐
        │ 🏠 📖 📅 📦 👤  │
        └──────────────────┘
```

### Modal "Détail Jour"

```
╔═════════════════════════════════╗
║ Lundi 26 mai 2026           ✕   ║
╠═════════════════════════════════╣
║ Total: 1346 kcal                ║
║                                 ║
║ 🍽️  Pâtes Carbonara 12:30       ║
║    250g · 450 kcal              ║
║                                 ║
║ 🥗 Salade Verte 14:15            ║
║    150g · 45 kcal               ║
║                                 ║
║ 🥤 Jus d'Orange 15:00            ║
║    250ml · 112 kcal             ║
║                                 ║
║ 🍪 Biscuit Chocolat 16:30        ║
║    1 pièce · 150 kcal           ║
║                                 ║
║ 🍝 Riz Blanc 19:00               ║
║    300g · 579 kcal              ║
║                                 ║
║ [Fermer]                        ║
║                                 ║
╚═════════════════════════════════╝
```

---

## 7. COURSES (courses.html)

```
┌─────────────────────────────────┐
│ 🛒 Courses                       │
│              [F]                │
└─────────────────────────────────┘

  Semaine 22 (25-31 mai)
  [🔄 Régénérer]

┌─────────────────────────────────┐
│ FRUITS                          │
├─────────────────────────────────┤
│ ☐ Tomates Cerises       250g    │
│ ☐ Fraises               500g    │
│ ☐ Pommes                 3pcs   │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ LÉGUMES                         │
├─────────────────────────────────┤
│ ☐ Laitue                 1pcs   │
│ ☐ Oignons                500g   │
│ ☐ Poivrons Rouges         2pcs  │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ PRODUITS LAITIERS              │
├─────────────────────────────────┤
│ ☐ Lait                   1litre │
│ ☐ Beurre                 250g   │
│ ☐ Œufs                    12pcs │
│ ☐ Fromage Camembert        2pcs │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ VIANDES                         │
├─────────────────────────────────┤
│ ☐ Lardons Fumés          300g   │
│ ☐ Poulet Fermier         1kg    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ FÉCULENTS & AUTRES              │
├─────────────────────────────────┤
│ ☐ Pâtes                  500g   │
│ ☐ Riz Blanc              500g   │
│ ☐ Crème Fraîche          400ml  │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ TOTAL ESTIMÉ: 87,50 EUR         │
└─────────────────────────────────┘

        ┌──────────────────┐
        │ 🏠 📖 📅 📦 👤  │
        └──────────────────┘
```

---

## Navigation Bar (All Pages)

```
┌───────────┬───────────┬───────────┬───────────┬───────────┐
│ 🏠        │ 📖        │ 📅        │ 📦        │ 👤        │
│ Accueil   │ Recettes  │ Planning  │ Inventaire│ Profils   │
│ (active)  │           │           │           │           │
└───────────┴───────────┴───────────┴───────────┴───────────┘
```

---

## Color Scheme

- **Primary:** #2e7d32 (green)
- **Primary Light:** #4caf50
- **Primary BG:** #f1f8f1
- **Border:** #c8e6c9
- **Danger:** #e74c3c (red)
- **Warning:** #e67e22 (orange)
- **Success:** #27ae60 (dark green)
- **Text Primary:** #222
- **Text Secondary:** #999
- **Background:** #f5f5f5
- **White:** #fff
- **Border Light:** #eee

---

## Notes

- All pages have fixed bottom nav (56px height)
- Page content padding: 12px sides, 70px bottom (above nav)
- Modals slide up from bottom
- Cards have subtle shadow + 10px border radius
- Form inputs: 8px padding, green border on focus
- Buttons: primary (green), secondary (light green), danger (red)
- Responsive: tested at 320px+ (mobile first)

