# MealFlow — Feuille de route « passer pro »

Document de référence : ce qu'il faudrait pour transformer MealFlow d'une **excellente app perso/famille** en une **vraie application professionnelle** (publique, scalable, données sécurisées). Rien d'urgent — c'est une carte pour plus tard.

---

## 1. Où on en est aujourd'hui

**Solide :**
- App multi-fonctions complète (repas, recettes, planning, courses, inventaire, profils)
- Sécurité de base réglée (XSS échappé, token en sessionStorage, clé API restreinte)
- Classification alimentaire intelligente (régime / allergies / aversions)
- Multi-comptes propre (profil détecté par compte Google)
- Outillage dev (tests Vitest + ESLint)
- Couche d'accès aux données **centralisée** dans `js/sheets-api.js` ← très important pour la suite

**Verdict :** prod-ready pour un usage **perso/famille**. Pour du **pro public**, il reste surtout le backend et quelques chantiers connus.

---

## 2. Le verrou principal : remplacer Google Sheets

Google Sheets est parfait pour démarrer, mais c'est le plafond pour du pro :

| Problème | Conséquence |
|---|---|
| Pas une vraie base de données | Pas de transactions, lent, schéma fragile (positions de colonnes) |
| Quotas API (429) | L'app se bloque sous charge |
| Pas d'isolation par utilisateur | Avec la clé API, on peut lire les données de **tout le monde** dans le classeur |
| Données santé sensibles (poids, allergies) | Problème **RGPD** réel si l'app est publique |

### → Solution recommandée : **Supabase**

Supabase = Postgres (vraie DB) + Auth + API auto + **Row-Level Security** (isolation par utilisateur), avec un free tier généreux. C'est **le levier #1** : il débloque d'un coup la sécurité, le multi-utilisateur, la performance et l'auth.

**Pourquoi la migration est faisable sans tout casser :** toute l'app passe par `js/sheets-api.js`. On peut réécrire ce seul fichier pour parler à Supabase au lieu de Sheets, en gardant la même interface (`readSheetTab`, `appendRowWithToken`, etc.). L'UI ne change presque pas.

**Étapes de migration Sheets → Supabase :**
1. Créer un projet Supabase + définir les tables (`profiles`, `inventory`, `recipes`, `planning`, `courses`, `history`) — fini les colonnes positionnelles, place à un vrai schéma typé.
2. Activer **Row-Level Security** : chaque utilisateur ne voit que ses lignes (`user_id = auth.uid()`).
3. Réécrire `js/sheets-api.js` → `js/data-api.js` avec le client Supabase (mêmes noms de fonctions = le reste de l'app marche).
4. Script de migration ponctuel : exporter le Google Sheet → importer dans Supabase.
5. Remplacer l'auth Google client-side par **Supabase Auth** (Google, email/mot de passe, reset…).

**Alternative :** Firebase (Firestore + Auth). Plus simple sur certains points, mais Postgres/Supabase est plus « pro » et standard.

---

## 3. Les autres chantiers (par priorité)

### Priorité haute

**Auth robuste**
- Aujourd'hui : OAuth Google en mode « Testing » (cap 100 comptes, écran de consentement effrayant, tout côté client).
- Pro : Supabase Auth ou app Google **vérifiée**. Email/mot de passe + réinitialisation. Sessions sécurisées.

**Isolation des données (multi-tenant)**
- Aujourd'hui : un seul classeur partagé.
- Pro : chaque utilisateur = ses propres données, inaccessibles aux autres (Row-Level Security côté Supabase). C'est la base d'une app publique.

**Légal / RGPD** (obligatoire si public, surtout avec données santé)
- Politique de confidentialité + CGU
- Consentement
- Export et suppression des données utilisateur (« droit à l'oubli »)
- Les allergies/poids sont des **données de santé** = catégorie sensible → exigences renforcées.

### Priorité moyenne

**PWA / Offline**
- Aujourd'hui : web responsive, mais pas installable, pas d'offline.
- Pro : ajouter un `manifest.json` + un **service worker** → app installable sur téléphone, fonctionne hors-ligne (pertinent : on cuisine sans forcément du réseau), synchro au retour du réseau.

**CI/CD (intégration continue)**
- Aujourd'hui : tests/lint lancés à la main.
- Pro : **GitHub Actions** → à chaque `push`, lance automatiquement lint + tests, et déploie si tout est vert. Empêche de casser la prod.

**Monitoring / observabilité**
- Aujourd'hui : `console.log`.
- Pro : **Sentry** (remontée automatique des erreurs des utilisateurs) + analytics d'usage.

### Priorité basse (confort / scalabilité long terme)

**Architecture / framework**
- Aujourd'hui : JavaScript « vanilla » avec scripts globaux, sans build.
- Pro / scalable : passer à **Vite + un framework** (React, Vue ou Svelte) + **TypeScript**. Composants réutilisables, état géré proprement, typage = moins de bugs. Migration **progressive** possible, page par page.

**Design system & UX**
- Composants cohérents, états de chargement/vides, accessibilité (a11y : navigation clavier, lecteurs d'écran), éventuellement thème clair/sombre.

**Tests étendus**
- Aujourd'hui : 17 tests unitaires sur les fonctions pures.
- Pro : plus de couverture + tests **end-to-end** (Playwright) qui simulent un vrai parcours utilisateur dans le navigateur.

---

## 4. Ordre conseillé (incrémental)

On peut tout faire par petits pas, sans big-bang :

1. **Supabase** : migrer la couche données (débloque sécurité + multi-user + perf). ⭐ le gros morceau
2. **Auth Supabase** : remplacer le login Google client-side.
3. **RGPD** : politique de confidentialité + export/suppression données (si public).
4. **PWA** : manifest + service worker (installable + offline).
5. **CI** : GitHub Actions (lint/test/déploiement auto).
6. **Monitoring** : Sentry.
7. **Refactor framework + TypeScript** : progressif, quand le besoin de scalabilité arrive.

---

## 5. Quick wins (faisables vite, sans gros chantier)

Même en restant sur l'archi actuelle, on peut professionnaliser un peu :
- `manifest.json` + icônes → app « installable » sur mobile (mini-PWA)
- GitHub Action simple : lint + tests à chaque push
- README + doc de setup (le README a été supprimé — à recréer)
- États de chargement / messages d'erreur plus soignés
- Sentry (quelques lignes) pour voir les erreurs réelles

---

## 6. Estimation grossière

| Chantier | Effort | Impact |
|---|---|---|
| Migration Supabase (données + auth) | Élevé | ⭐⭐⭐ Débloque tout |
| RGPD / légal | Moyen | ⭐⭐⭐ Obligatoire si public |
| PWA / offline | Moyen | ⭐⭐ Confort mobile |
| CI/CD | Faible | ⭐⭐ Qualité continue |
| Monitoring (Sentry) | Faible | ⭐⭐ Visibilité |
| Refactor framework + TS | Élevé | ⭐ Scalabilité long terme |

**Règle de pouce :** la migration Supabase ≈ 60 % du chemin vers « pro ». Le reste (PWA, CI, légal, monitoring) sont des chantiers connus et bornés, à faire par incréments.

---

## 7. En une phrase

> MealFlow est déjà une vraie app pour un usage perso/famille. Pour devenir une app pro publique, le travail principal est de **remplacer Google Sheets par un vrai backend (Supabase)** — le reste suit naturellement, par petites étapes.

---

# Partie B — Vision produit (la version pro cible)

Cette partie décrit **ce que serait MealFlow en application pro complète**, pensée pour le cas réel : une maman planifie la semaine pour elle, son mari et ses enfants.

## B.1 Modèle « Compte mère » (Foyer)

Trois notions à bien distinguer :

| Notion | Définition | Exemple |
|---|---|---|
| **Compte** | Une identité de connexion (Google / email) | Le compte de la maman, celui du mari |
| **Profil** | Une personne pour qui on cuisine (régime, allergies, calories) — peut ne **pas** avoir de compte | Les enfants |
| **Foyer** | Le conteneur partagé qui regroupe comptes + profils | La famille Dupont |

**Compte mère (owner)** = celui qui crée le foyer et le gère.

### Ce qui est partagé dans un foyer
Toutes les ressources « ménage » sont **communes à tous les comptes liés au foyer** :
- 🛒 Liste de courses
- 📅 Planning de la semaine
- 📖 Recettes
- 📦 Inventaire

### Ce qui reste par profil
- Régime / allergies / aversions / objectif calorique
- Historique de consommation, suivi calories/macros, stats

### Plusieurs foyers
- Plusieurs comptes mère = plusieurs foyers indépendants.
- **Règle absolue : aucune donnée ne circule entre foyers.**

## B.2 Isolation stricte entre foyers

C'est exactement ce que **Supabase + Row-Level Security** fait nativement et de façon robuste :
- Chaque table porte une colonne `household_id` (id du foyer).
- Une *policy* RLS : un utilisateur ne peut lire/écrire que les lignes de **son** foyer (`household_id` ∈ mes foyers).
- Résultat : impossible techniquement de voir les données d'un autre foyer, même en bidouillant le client.

→ Ça confirme que **Supabase est le move #1** : le modèle foyer multi-tenant en découle directement.

## B.3 Rôles & permissions
- **Owner (compte mère)** : gère les membres (inviter/retirer), les profils, l'abonnement.
- **Membre** : utilise et édite le planning/courses/recettes/inventaire partagés.
- **Profil enfant** : pas de connexion, géré par les parents.
- (Optionnel plus tard : rôle « lecture seule » pour un ado.)

## B.4 Feature phare — Génération automatique du planning ⭐

Une fois assez de recettes créées, un **moteur** génère la semaine (midi/soir × 7 jours) automatiquement, en respectant **les contraintes de tous les profils qui mangent** :

Contraintes prises en compte :
- ❌ Exclut les recettes incompatibles avec une **allergie** ou un **régime** d'un des mangeurs
- 👎 Évite les **aversions**
- 🔥 Équilibre selon les **objectifs caloriques** de chacun
- 🔁 Assure la **variété** (pas deux fois la même recette, rotation)
- 📦 (Option) Privilégie ce qui est **en stock** et **bientôt périmé**
- ⏱️ (Option) Respecte le temps de prépa / niveau culinaire du profil

Puis :
- Génère la **liste de courses** agrégée pour la semaine.
- Permet d'**ajuster** : régénérer, verrouiller un repas qu'on veut garder, remplacer un repas.

**Bonne nouvelle :** les briques existent déjà (`js/diet.js` pour la classification régime/allergie/aversion, calcul calories, détection « réalisable avec l'inventaire »). Le moteur ne fait que **combiner** ces briques en un solveur de contraintes. C'est le cœur de valeur de la version pro.

**Deux moteurs complémentaires (prévus) :**
- **Moteur à règles** : combine les contraintes déjà codées (déterministe, gratuit, prévisible).
- ⭐ **Moteur IA** : génère **recettes ET planning** en langage naturel (« planning végé pas cher pour 4 »), crée des recettes à partir du stock, propose des variantes. Plus créatif, vrai argument premium. Idéalement, l'IA propose et le moteur à règles **valide** les contraintes (allergies/régimes) avant d'afficher → le meilleur des deux.

## B.5 Monétisation — abonnement ~5 €/mois

Modèle **freemium** (gratuit limité + premium) :

| | Gratuit | Premium ~5 €/mois |
|---|---|---|
| Foyer | 1 | 1 |
| Profils | 1–2 | **Illimités** (toute la famille) |
| Planning | Manuel | **Génération automatique** ⭐ |
| Recettes | Limité (ex. 15) | Illimité |
| Suivi calories/macros | Basique | **Détaillé + historique + stats** |
| Liste de courses | Simple | **Intelligente** (stock, budget, alertes péremption/stock bas) |
| Extras | — | Export courses, partage, suggestions, notifications |

*(Ce sont des exemples — à affiner selon ce qui apporte le plus de valeur ressentie.)*

**Paiement :**
- Web : **Stripe** (abonnements récurrents).
- Mobile : abonnements **in-app** (Play Store / App Store prennent ~15–30 % de commission — à intégrer dans le prix).

**Idées d'avantages premium supplémentaires :**
- Génération auto du planning (le gros argument)
- Suivi nutritionnel complet (calories, protéines/glucides/lipides, courbes)
- Courses : budget estimé, regroupement par rayon, cocher en magasin, historique des prix
- Alertes : « X périme demain », « plus de lait », « planning de la semaine prêt »
- Scan de ticket de caisse → mise à jour inventaire (ambitieux)
- Suggestions de recettes selon le stock et les goûts

## B.6 Application mobile (Play Store)

Cible : une appli mobile fluide pour planifier en famille.

Deux chemins :
- **PWA → TWA** (Trusted Web Activity, via Bubblewrap) : on garde l'app web, on l'emballe pour la publier sur le **Play Store**. Rapide, un seul code.
- **Natif / hybride** (React Native ou Capacitor) : meilleure intégration (notifications push fiables, perfs, ressenti « vraie app »). Plus de travail.

**Recommandation :** commencer **PWA installable** → publier en **TWA sur le Play Store** → passer au natif si la traction le justifie.

**Notifications push** (clé pour l'engagement) :
- « Ton planning de la semaine est prêt »
- « Il te manque X pour la recette de ce soir »
- « 3 produits périment bientôt »
- Rappels de courses

## B.7 Stack pro cible (récap)

| Couche | Techno |
|---|---|
| Backend / DB / Auth | **Supabase** (Postgres + Auth + RLS + Realtime + Storage) |
| Front web | React ou Vue + **TypeScript** + Vite |
| Mobile | PWA→TWA, puis React Native / Capacitor |
| Paiement | **Stripe** + abonnements in-app |
| Notifications push | Firebase Cloud Messaging / Expo |
| Monitoring | Sentry |
| CI/CD | GitHub Actions |

## B.8 Les 2 vrais défis techniques

1. **Le modèle foyer multi-tenant avec isolation stricte** → résolu par Supabase + RLS (`household_id`).
2. **Le moteur de génération de planning multi-contraintes** → la vraie valeur ; s'appuie sur les briques déjà construites (diet.js, calories, inventaire).

Tout le reste (mobile, paiement, push, légal) sont des chantiers connus et bornés. **Le socle, encore et toujours, c'est le backend Supabase.**

## B.9 Ordre de construction suggéré (version pro)

1. **Supabase** : schéma `households / members / profiles / recipes / inventory / planning / courses / history` + RLS par `household_id`.
2. **Auth + foyers** : inscription, création de foyer, invitation de membres, gestion des profils (dont enfants sans compte).
3. **Migrer l'app actuelle** dessus (réécrire `sheets-api.js` → client Supabase, l'UI suit).
4. **Moteur de génération de planning** (la feature phare premium).
5. **Abonnement** (Stripe + freemium gating).
6. **Mobile** (PWA → Play Store) + **notifications push**.
7. **Légal/RGPD** (données santé) + monitoring.

> Vision en une phrase : **un foyer, plusieurs profils (parents + enfants), des recettes/courses/planning partagés et isolés des autres foyers, avec un planning de la semaine généré automatiquement selon les régimes et allergies de chacun — le tout en abonnement, sur le Play Store.**

## B.10 Idées d'amélioration (suggestions à creuser)

Pistes de fonctionnalités pour enrichir la version pro. À trier selon la valeur ressentie. Les ⭐ sont des **différenciateurs forts** (ce qui ferait choisir MealFlow plutôt qu'un concurrent).

### Planning & recettes
- **« Qui mange quoi »** : tout le monde ne mange pas pareil au même repas (un enfant a un plat différent) → le planning gère un plat principal + variantes par profil.
- **Portions adaptatives** : si un membre est absent un soir, recalcule automatiquement les quantités (et donc les courses).
- **Semaine-type réutilisable** : enregistrer un modèle de semaine et le réappliquer.
- **Rythme semaine/weekend** : recettes rapides en semaine, plus élaborées le weekend (selon temps de prépa).
- ⭐ **Anti-gaspillage** : « cuisine avec ce qui périme bientôt » → le moteur privilégie les ingrédients proches de la date limite.
- **Batch cooking / meal prep** : mode « je cuisine en lot le dimanche » → regroupe les recettes compatibles.
- **Éviter la répétition sur plusieurs semaines** (mémoire de rotation, pas que sur 1 semaine).
- ⭐ **Import de recette depuis une URL ou une photo** (scraping / OCR) → ajouter une recette du web en 1 clic.
- **Notes & évaluations de recettes** : « les enfants ont adoré », note sur 5 → influence les futures suggestions.
- **Liste de souhaits des enfants** : ils proposent des repas, les parents valident.

### Courses & inventaire
- ⭐ **Liste de courses en temps réel partagée** : un parent coche en magasin, l'autre voit la mise à jour live (Supabase Realtime).
- **Tri par rayon / parcours du magasin** (ordre logique dans les allées).
- **Budget** : total estimé, suivi des dépenses dans le temps, courbe mensuelle.
- ⭐ **Scan du ticket de caisse** → met à jour l'inventaire et les prix automatiquement (gros gain de temps).
- **Scan code-barre à la maison** pour entrer/sortir du stock rapidement.
- **Multi-magasins** : comparer les prix, répartir la liste.
- **Quantités suggérées** selon la consommation passée (« tu achètes ~2L de lait/semaine »).

### Nutrition & santé
- **Suivi macros complet** par profil (protéines / glucides / lipides) + courbes.
- **Adaptation auto des portions** aux objectifs (perte / maintien / prise de masse).
- **Bilans nutritionnels hebdo** : « trop de sel cette semaine », « pas assez de légumes » → suggestions correctives.
- **Profils à besoins spécifiques** : enfant, sportif, grossesse, senior (besoins caloriques/nutriments adaptés).
- **Intégration Apple Health / Google Fit** : poids, activité → ajuste les objectifs.

### Famille & engagement
- **Rotation « qui cuisine ce soir »** (répartition des tâches dans le foyer).
- **Récap hebdomadaire** : « cette semaine : X € de courses, Y repas équilibrés, 0 gaspillage ».
- **Gamification légère** : badges anti-gaspi, « semaine équilibrée », régularité.
- **Partage de recettes entre foyers** (opt-in, sans jamais partager les données privées) → bibliothèque communautaire.
- **Onboarding guidé** à la première utilisation (créer foyer → profils → 1ères recettes → 1er planning auto).

### Intelligence artificielle (gros différenciateur)
- ⭐ **Assistant IA en langage naturel** : « génère-moi un planning végé, pas cher, pour 4 cette semaine » → l'IA propose.
- ⭐ **Génération de recettes à partir du stock** : « voici ce que j'ai dans le frigo, propose un dîner ».
- **Parsing intelligent** d'une recette (photo / URL / texte collé) → structurée automatiquement (ingrédients, étapes).
- **Suggestions personnalisées qui apprennent** les goûts du foyer au fil du temps.

### Technique / qualité de vie
- **Realtime sync** (Supabase Realtime) : toute modif (planning, courses) visible instantanément sur tous les appareils du foyer.
- **Mode hors-ligne robuste** (PWA + cache + synchro différée) — on cuisine sans réseau.
- **Multi-langue (i18n)** si ouverture internationale.
- **Accessibilité (a11y)** : navigation clavier, lecteurs d'écran, contrastes.
- **Thème clair / sombre**.

### Si recentrage « valeur premium »
Les fonctionnalités qui justifient le mieux l'abonnement (à mettre en avant) :
1. ⭐ Génération automatique du planning multi-contraintes
2. ⭐ Anti-gaspillage (privilégier le stock / périmé)
3. ⭐ Liste de courses temps réel partagée + scan ticket
4. ⭐ Assistant / génération IA
5. Suivi nutritionnel complet de toute la famille

> Note : ne pas tout construire d'un coup. Sortir un **MVP premium** centré sur **1–2 différenciateurs forts** (génération auto du planning + anti-gaspillage), puis enrichir selon les retours utilisateurs.
