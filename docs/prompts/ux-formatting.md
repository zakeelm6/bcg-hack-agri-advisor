# Prompt pour Cursor : améliorer la mise en forme et l'UX de Farm Advisor

Colle le texte ci-dessous dans Cursor (mode Agent), avec le dossier `farm-advisor/` ouvert comme racine.

---

## Contexte

Tu travailles sur **Farm Advisor**, un site web (pas une application mobile) pour le BCG Platinion Hackathon 2026, thème "Fighting World Hunger". Il lit les données d'un champ (image satellite Sentinel-2, météo, capteurs de sol partagés, analyses de sol, photos) et dit à un petit agriculteur quoi faire, quand, pourquoi, combien ça coûte, avec quel niveau de confiance et quel plan B. Un **Copilot** (texte + voix) explique les conseils.

Stack : FastAPI + SQLite côté serveur, JavaScript natif (sans framework), hash routing, service worker, trois langues (en, fr, ar avec RTL). Lis d'abord `README.md`, puis `static/index.html`, `static/style.css`, `static/app.js`, `static/i18n.js`.

## Objectif

Améliorer **uniquement** la mise en forme visuelle et l'expérience utilisateur, sans changer la logique métier. L'interface doit ressembler à un **appareil de terrain** : très peu de mots, gros éléments tactiles, lisible en plein soleil, utilisable avec des mains sales.

## Contraintes à respecter absolument

1. Ne modifie pas `app/engine.py`, `app/copilot.py` ni les tests. Le code décide des chiffres, le modèle ne fait qu'expliquer.
2. Aucun nouveau framework ni outil de build (pas de React, Tailwind, npm). Fichiers statiques seulement. Tu peux ajouter une police ou une icône si elle est locale ou déjà sur Google Fonts.
3. L'anglais est la langue source dans `app.js`. Tout nouveau texte doit être ajouté dans le tableau `T` de `static/i18n.js` avec ses versions fr et ar. Aucun texte en dur dans une seule langue.
4. Arabe = droite à gauche : utilise des propriétés logiques (`margin-inline-start`, `inset-inline-end`, etc.), jamais `left/right` pour la mise en page. Vérifie chaque écran en RTL.
5. L'accueil montre **la parcelle** (image satellite avec 4 zones colorées, capteurs, tâche) à côté du **Copilot** avec le micro. Garde ce principe.
6. La page occupe **toute la fenêtre** sur ordinateur (pas de largeur maximale). Sur téléphone : barre de navigation en bas.
7. Accessibilité : contraste AA minimum, cibles tactiles d'au moins 44 px, `aria-label` sur les boutons-icônes, focus visible, `prefers-reduced-motion` respecté.
8. Fonctionne hors ligne (service worker). Si tu ajoutes un fichier au shell, mets-le dans `static/sw.js` et incrémente le nom du cache.
9. Garde honnête l'étiquetage "réel / simulé" des données : ne le masque pas pour faire joli.

## Ce que je veux que tu fasses

1. **Audit rapide** : lance l'app (`./run.sh`, http://localhost:8000), parcours chaque écran (Accueil, Champ, Tâches, détail d'une tâche, Alertes, Vente, Moi) en anglais, français et arabe, sur 1440 px et 390 px de large. Liste les problèmes visuels (alignement, espacements, hiérarchie, texte coupé, débordements, incohérences) avant de corriger.
2. **Système de design** : définis des variables CSS en haut de `style.css` (couleurs, espacements sur une échelle de 4 px, rayons, ombres, tailles de texte) et remplace les valeurs en dur. Palette sobre : vert agricole, crème, un accent pour les alertes. Mode sombre optionnel via `prefers-color-scheme`.
3. **Hiérarchie** : sur chaque écran, une seule action principale évidente. La carte de tâche affiche d'abord l'action (verbe + zone), puis quand, puis le reste (pourquoi, coût, confiance, plan B) en détail repliable.
4. **Accueil** : la parcelle et le Copilot doivent être le point focal. Micro grand, état clair (écoute, réflexion, réponse), questions rapides en puces, réponse lue à voix haute avec un bouton pour couper le son. Ajoute des états de chargement (squelettes) et des états vides utiles.
5. **Retours visuels** : transitions courtes (150 à 250 ms), toasts, état hors ligne bien visible (bandeau discret), confirmation quand une tâche est faite.
6. **Moins de mots** : réduis les textes à l'essentiel, remplace-les par des icônes + libellé court quand c'est clair. Mets à jour les trois langues.
7. **Responsive** : trois points de rupture (téléphone, tablette, ordinateur). Pas de défilement horizontal de la page.
8. **Qualité** : pas de duplication CSS, noms de classes cohérents, pas d'erreur dans la console.

## Vérification avant de terminer

- `python -m pytest -q` : les 42 tests passent toujours.
- `node --check static/app.js static/i18n.js static/sw.js` sans erreur.
- Captures d'écran avant/après de chaque écran dans les trois langues (dossier `docs/ux/`).
- Une liste courte de ce qui a changé et de ce qui reste à faire.

Travaille par petites étapes, un écran à la fois, et montre-moi le résultat après l'accueil avant de continuer.
