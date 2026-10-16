# AgriMind : ce que fait l'IA et comment les données sont traitées en interne

Source unique : `HANDOFF.md` (le code d'AgriMind n'est pas dans ce dossier). Tout ce qui suit est donc lu dans cette
note de passation, pas vérifié dans le code. Quand le document ne dit pas quelque chose, c'est écrit comme tel.
Rien n'a été copié ni implémenté dans Farm Advisor : ce fichier sert à comprendre, puis à décider quoi reprendre.

## 1. Vue d'ensemble

```
réponses de l'agriculteur (JSON)
        |
        v
 GRAPHE DE PLANIFICATION (LangGraph, environ 50 s, mis en cache sur disque)
        |   produit : profil, eau, cultures viables, 3 stratégies, décision, plan final, acheteurs
        v
 BOUCLE DE SAISON (graphe quotidien LangGraph, environ 0,5 s pour toute la saison)
        |   produit : pour chaque jour, au plus 3 tâches vérifiées, plus un briefing parlé
        v
 UN SEUL DOCUMENT JSON ("run")  ->  l'interface le rejoue, 1 tour = 1 semaine
```

Le front et le back ne se rejoignent que sur ce document JSON. C'est le contrat, donc le front peut être remplacé sans toucher au back.

## 2. Première phase : le graphe de planification

Il tourne une fois par jeu de réponses, puis le résultat est mis en cache (voir section 6).

### 2.1 Entrée et validation
- Le formulaire est validé (`schemas.py::FarmerInput`). Obligatoires : position GPS, surface, type de sol, source d'eau,
  quota d'eau, date de début, budget, distance au marché.
- Optionnels, avec valeurs par défaut : pente, risques de gel et de vent, coût de l'eau (calculé si absent), salinité de l'eau,
  méthode d'irrigation, analyse de sol, main-d'oeuvre, culture précédente, culture habituelle, langue, etc.
- **Si une réponse obligatoire manque, le système ne devine pas** : il renvoie `needs_input` avec des questions écrites
  dans la langue de l'agriculteur, et l'interface les affiche puis renvoie le formulaire.
- Les hypothèses que le système a dû faire (par exemple « pas d'analyse de sol ») sont listées dans `assumptions[]`.

### 2.2 Les étapes (d'après les noms cités dans le document)

| Étape | Rôle (selon le document) | LLM ? |
|---|---|---|
| **A1, profil** | Texture du sol, réserve utile en eau, pH, matière organique, plus des « insights » avec preuves. Peut utiliser les normales climatiques (Open-Meteo) et SoilGrids pour la position GPS si `AGRIMIND_ONLINE=1`. | Non précisé |
| **A2, eau** | Coût de l'eau par m3, quota, méthode d'irrigation recommandée et pourquoi, niveau de rareté, besoin en eau par culture. | Non précisé |
| **Sélection des cultures** (`crop_selector`) | Garde les légumes viables (filtres) avec leur économie : profit par ha, eau par ha, risque, adéquation. Génère aussi les stratégies. | Non précisé |
| **Stratégies V1, V2, V3** | Chacune = un but (nom, goal), une affectation de 16 parcelles à des cultures, des dates de semis, une méthode d'irrigation, des soins, un coût d'investissement et un besoin de travail. | Génération par code |
| **Simulation Monte Carlo** | Chaque stratégie est jouée sur des saisons météo tirées au hasard (20 + 20 scénarios, ou 6 + 6 en mode rapide). Mesures : profit moyen, profit dans les 10 % pires cas (CVaR), probabilité de perte, eau, pic de travail. | Non (code) |
| **Baseline** | La « pratique habituelle » de l'agriculteur jouée sur les mêmes saisons : culture habituelle partout, irrigation calendaire par inondation limitée au quota, une seule dose d'engrais, pas de protection contre le gel, semis 2 semaines plus tard. Les économies annoncées dépendent de ce modèle. | Non |
| **Juge** (`decision/judge.py`) | Note chaque stratégie avec des critères pondérés (profit, risque de baisse, eau, travail), applique des contraintes, désigne un gagnant et un second, mesure la stabilité du classement. | **Code** pour décider |
| **Explication du juge** | Met en mots pourquoi cette stratégie gagne. Rejetée si un chiffre n'est pas traçable jusqu'au simulateur (`judge_numeric_faithfulness`). | **LLM** (sinon texte déterministe) |
| **Optimiseur** (`decision/optimizer.py`) | Teste de petits changements (« moves ») sur le plan gagnant, garde ceux qui améliorent. Validé sur de la météo jamais vue (`HOLDOUT_SEEDS`) pour éviter le sur-réglage. | Non (code) |
| **Plan final** | `final_plan` (plan retenu) et `trad_plan` (pratique habituelle) : culture par parcelle, dates de semis, méthode, apports d'engrais, durée de saison. | Non |
| **Acheteurs et attendus** | Liste d'acheteurs avec cultures, volumes, valeur estimée, plus récolte et profit attendus pour une saison médiane. | Non |
| **Trace** | Journal du planning : agent, nom, type (LLM ou outil), résumé, durée en ms. Montré dans l'interface. | n/a |

Le simulateur sous-jacent (`tools/simulator.py`) est un modèle simplifié : bilan hydrique FAO-56 à coefficient cultural unique,
réponse du rendement FAO-33, gel, chaleur et risque de maladie fongique selon les périodes humides. Les valeurs des
cultures (Kc, sensibilité, prix, travail) sont des valeurs typiques à calibrer localement.

## 3. Deuxième phase : la boucle de saison (graphe quotidien)

Pour chaque jour de la saison, le graphe quotidien (`graph/daily.py`) fait ceci (d'après les fonctions citées : `generate_tasks`,
`execute`, vérificateur) :

1. **Lire l'état du champ** via `FarmSim` (méthodes `snapshot`, `active`, `dsow`, `root_taw`, `Dr`, `water_used`).
2. **Générer les tâches du jour** à partir du plan et de l'état : `prepare_soil`, `sow`, `irrigate`, `fertilize`, `cover_frost`,
   `scout_spray`, `harvest`, `pack_transport`. Les quantités viennent des outils (`tools/`, règles dans `tools/policy.py`),
   jamais du modèle de langage.
3. **Limiter** : au plus 3 tâches par jour, avec une priorité de 1 à 3.
4. **Vérifier** chaque tâche (`evals/task_metrics.py`). Le vérificateur recalcule les quantités et donne un score, avec des
   métriques déterministes. Résultat :
   - `verified` : correcte ;
   - `fixed` : corrigée automatiquement (par exemple quantité plafonnée) ;
   - `escalated` : **non exécutée**, l'agriculteur est renvoyé vers son conseiller. Ces tâches ne doivent jamais être cachées.
5. **Exécuter** (`execute`) : seules les tâches `verified` ou `fixed` modifient le champ simulé. Principe : ce que l'agriculteur
   entend est ce qui se passe dans le champ.
6. **Rédiger** la phrase à lire à voix haute (`script` en fr, en, ar), sans jargon, plus un `briefing` du jour dans les trois langues.
7. **Enregistrer** pour chaque semaine : météo, état des parcelles (stade, canopée, humidité, santé, stress, eau irriguée, rendement),
   événements (semis, gel, flétrissement, maladie, récolte), mode de l'agent (`normal`, `watch`, `drought`).

La boucle tourne en parallèle pour la ferme de l'agent et pour la ferme « traditionnelle », ce qui permet de comparer à la fin
(`outcome`, `savings`).

Chaque tâche contient : action, parcelles, culture, quantité et unité (minutes de pompe, kg, heures, caisses), raison, priorité,
« que se passe-t-il si je ne le fais pas », preuves (références à la base de connaissances), statut, script et détail de vérification.
Un champ `injected_fault` existe seulement quand le **test de résistance du vérificateur** a corrompu une tâche exprès.

## 4. Où intervient exactement l'IA

| Rôle | Fait par un LLM ? | Garde-fou |
|---|---|---|
| Décider une quantité, une date, une dose | **Jamais** | Calculé par `tools/`, recalculé par le vérificateur |
| Choisir la meilleure stratégie | Non, le juge est du code | Critères et contraintes explicites |
| Expliquer le choix du juge | Oui, si une clé est configurée | Rejeté si un chiffre n'est pas traçable |
| Rédiger le script parlé et le briefing | Oui, avec repli sur des modèles de phrases | Validé par schéma pydantic, repli déterministe en cas d'échec |
| Orchestration des étapes | Les graphes LangGraph (pas un LLM libre) | Étapes et sorties typées |
| Métriques de qualité de type juge LLM (GEval) | Oui | **Sautées, jamais simulées**, sans clé |

Sans clé API, tout fonctionne en mode déterministe (`AGRIMIND_OFFLINE=1` force ce mode même avec une clé). Les chemins
avec un vrai modèle sont écrits mais, d'après le document, **pas encore testés sur un modèle réel**. Les chiffres de démonstration
viennent du mode hors ligne.

## 5. Les autres briques « IA » autour

- **Base de connaissances (RAG)** : fichiers `rag/kb/*.md` découpés en sections `## [id] Titre`. Les identifiants sont cités comme
  preuves dans les tâches et les insights. Routes `/api/kb?q=...` et `/api/kb/{id}`.
- **Skills** : un dossier `skills/<nom>/SKILL.md` par compétence d'agent (nom, description, outils, usage du RAG), listé par `/api/skills`.
- **Évaluations** : rapport `evals_report.json` produit par `scripts/run_evals.py`, vérifications de type DeepEval pour le juge et l'optimiseur.
- **Voix** : `/api/tts` renvoie du MP3, ou **204 hors ligne** pour que le client bascule sur la synthèse du navigateur.
- **Injection de pannes** : `fault_rate` dans la requête corrompt volontairement des tâches pour prouver que le vérificateur les attrape.

## 6. Cache et reproductibilité

- La planification est mise en cache dans `cache/plan_<hash>.pkl`. La clé couvre : les réponses de l'agriculteur, le mode LLM, le drapeau
  FAST et la date de modification la plus récente de tout fichier de `backend/`. Modifier le code ou les données invalide donc le cache.
- Première requête pour un agriculteur : environ 50 s (planning). Ensuite : réponse immédiate.
- Une graine (`seed`) et une liste de chocs météo (`shocks` : gel, sécheresse, canicule) rendent une saison rejouable.
- Un jeu de démonstration (`demo_run.js`) permet d'ouvrir l'interface sans serveur.

## 7. Règles de conception du document (à garder si on reprend l'idée)

1. Le LLM ne produit jamais un chiffre.
2. Exécuté = vérifié.
3. Le code juge, le LLM explique.
4. L'optimiseur est validé sur une météo jamais vue.
5. Les métriques de juge LLM sont sautées, jamais inventées, sans clé.
6. La baseline est un modèle documenté, car les économies annoncées en dépendent.

## 8. Limites déclarées et points d'incertitude

Déclarées dans le document : modèle de culture simplifié, valeurs typiques à calibrer, maladies réduites au risque fongique par temps
humide, arabe à faire relire par un natif, chemins LLM non testés en réel, l'agent ne retarde pas un semis quand un gel est
prévu le jour même.

Mes propres réserves, parce que je n'ai pas le code :
- Je ne sais pas quelles étapes appellent un LLM en mode connecté, hormis l'explication du juge et les scripts parlés.
- Le détail de A1 et A2, les filtres du `crop_selector` et les critères exacts du juge ne sont pas décrits.
- Les chiffres (38 tests, environ 50 s, 20 + 20 scénarios) viennent du document, sans vérification.
- Tout est simulé : il n'y a pas de données réelles de capteur ni de satellite dans ce qui est décrit.

## 9. Comparaison avec Farm Advisor (pour décider quoi reprendre, sans rien implémenter)

| Idée d'AgriMind | Dans Farm Advisor aujourd'hui | Écart |
|---|---|---|
| Formulaire agriculteur avec validation et questions manquantes | Pas de formulaire de profil. Culture, surface et date de semis sont des valeurs de démonstration du champ. | À créer si utile |
| Graphe de planification de saison | Pas de plan de saison : le moteur réagit au jour le jour. | À créer |
| Boucle quotidienne qui génère au plus 3 tâches | Le moteur génère les tâches du jour (irrigation, engrais, inspection) à partir des données réelles. Pas de plafond de 3 ni de calendrier prévu. | Partiel |
| Vérificateur indépendant qui recalcule les quantités, statuts verified/fixed/escalated | Plafonds dans le moteur, et le Copilot rejette tout nombre absent des faits. Pas de statut par tâche. | Partiel, bonne idée à reprendre |
| Exécuter seulement ce qui est vérifié | Pas de simulateur d'exécution : les tâches vont à l'agriculteur. | Hors sujet (le simulateur de champ est exclu) |
| Script parlé et briefing du jour en 3 langues | Le Copilot lit les tâches (mode conversation), le texte vient des gabarits du moteur. | Proche |
| Juge multi-critères et optimiseur Monte Carlo | Absent. | Dépend du simulateur, que tu ne veux pas reprendre |
| RAG avec citations comme preuves | Absent. | À étudier |
| Cache de planification par hash | Pas de planification à mettre en cache. | Lié au graphe de planification |

Ce qui se transpose le mieux sans le simulateur : le formulaire avec questions manquantes, un plan de saison calculé par des outils
déterministes (calendrier d'irrigation et d'engrais selon la culture et la météo), le vérificateur par tâche, et le graphe
quotidien qui fusionne le plan avec les données réelles (satellite, capteurs, météo) de Farm Advisor.
