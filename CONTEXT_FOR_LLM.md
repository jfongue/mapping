# Treasure Quest — Contexte projet pour LLM

> Copie-colle ce fichier dans un nouveau chat LLM pour brainstormer la suite.
> Tout est ici : concept, stack, archi, features, critiques, manques, décisions ouvertes.

---

## 1. Concept

Jeu mobile (Android/iOS) d'exploration **contemplatif / idle**.

- Le joueur tape sur une grande map fantasy
- Son personnage s'y déplace en **temps réel** (1 à 5 min par trajet selon distance)
- **Notifications push** à l'arrivée
- **Multi** : voir d'autres joueurs sur la map, pas d'action live complexe (juste positions et échanges)
- Style : exploration relaxante, on lance un mouvement, on revient plus tard

---

## 2. Stack technique

- **React Native + Expo (~51)** — single codebase iOS/Android, test via Expo Go
- **react-native-svg 15** — rendu de la map (tiles, pièces, POI, paths)
- **react-native-gesture-handler 2** — pan caméra
- **expo-notifications** — push locales
- **AsyncStorage** — sauvegarde locale
- **Firebase Realtime DB 10** — multi en ligne (désactivé par défaut, mock fourni)
- **Jest 29** — tests unitaires

---

## 3. Architecture des fichiers

```
/Mapping/
├── App.js                  # Composant principal (~700 lignes, orchestration UI/animations)
├── SplashScreen.js         # Écran chargement animé (boussole + titre + loader)
├── multiplayer.js          # Re-export pour compatibilité
├── package.json            # deps + scripts jest
├── babel.config.js         # detect env.test pour preset-env
├── eas.json                # build APK preview (compte Expo configuré)
├── app.json                # config Expo
├── /src/                   # Logique pure (testable, pas de React)
│   ├── constants.js        # MAP_SIZE 3000x3000, TILE 50, vitesse 40px/s, types terrain, seeds, storage keys
│   ├── random.js           # mulberry32 PRNG + bruit de valeur 2D
│   ├── geometry.js         # distPointToSegment, distPointToPolyline, smoothPath (Catmull-Rom tension), sampleAt
│   ├── terrain.js          # generateTerrain (montagnes via bruit, 3 rivières sinueuses, ponts), isPassable, nearestPassable
│   ├── pathfinding.js      # A* sur grille 60x60 + simplification line-of-sight
│   ├── poi.js              # generateCoins (zones), generateChests (12, espacés 600px, reward 5-19), generatePOIs (5 villages, 3 ruines, 2 sanctuaires, noms fantasy)
│   ├── quests.js           # buildInitialQuests, updateQuests (immutable)
│   ├── gameplay.js         # pickupCoins/Chests, visitPOIs, revealedCellsAlongPath
│   ├── multiplayer.js      # MockMultiplayer + FirebaseMultiplayer (RTDB)
│   └── /__tests__/         # 7 fichiers Jest, ~60 tests
└── README.md
```

---

## 4. Features livrées

### 4.1 Map & terrain

- Map **3000×3000 px** (60×60 cellules de 50px)
- Terrain procédural **seedé** (déterministe) : herbe, eau, montagnes, ponts
- 3 **rivières sinueuses** traversantes (bruit pour ondulation)
- **Ponts** espacés ~10 cells, seul moyen de traverser l'eau
- Spawn central garanti en herbe (5×5 cells)

### 4.2 Mouvement

- Tap → A* vers `nearestPassable` (cellule passable la plus proche)
- **Lissage Catmull-Rom** (tension 0.6) pour courbes douces qui collent au polyline
- Durée = longueur courbe / vitesse (40 px/s), clampée 1-5 min
- Animation suivant la courbe via `Animated.Value` + listener
- **Caméra suit le perso** pendant déplacement (sauf si user a paneé manuellement)
- **2 variantes de trajet** proposées avant départ :
  - **Rapide** : A* direct
  - **Scénique** : passe par un POI/coffre/coin proche du segment direct (+5% min de longueur)
- **Notification push locale** à l'heure d'arrivée prévue

### 4.3 Économie & contenu

- **Pièces** : 1-2 par zone 400×800 px, ramassées si proches du trajet (rayon 40px le long de la polyline)
- **12 coffres** espacés 600px, ouverts à 80px du clic d'arrivée, reward 5-19 pièces (seedé)
- **10 POI nommés** (5 villages, 3 ruines, 2 sanctuaires) avec noms fantasy seedés (ex : Brindebourg, Cité Oubliée, Autel de la Lune)
- **3 quêtes** auto-tracking : récolter 10 pièces, visiter un village précis, explorer une ruine précise

### 4.4 UX / UI

- **Splash screen animé** : boussole rotative continue, titre "Treasure Quest" qui apparaît en spring scale, loader 3 points, fade out
- **Animation d'entrée map** : fade + scale spring depuis 1.2x
- **Tutoriel premier lancement** : bulle "Tape sur la map pour explorer", 3.5s puis fade
- **Modal pseudo** + ID anonyme persisté (1er lancement)
- **HUD** : compteur pièces (bas gauche), indicateur online (pseudo + nb joueurs, haut gauche), bouton reset ↺ (haut droite), bouton recenter ⊕ (apparaît si user a paneé)
- **Mini-carte permanente** coin droit (terrain simplifié + POI visités + autres joueurs + perso)
- **Panneau quêtes** coin gauche (3 quêtes max, ✓ animé)
- **Brouillard de guerre** persisté (cells révélées au passage, rayon 3 cells, overlay noir 85%)
- **Modal rapport d'arrivée** : mini-map du trajet style Strava (ligne rouge + pièces ramassées + start blanc + end rouge), distance, durée, pièces, coffres ouverts, POI découverts — **refactorisé en liste simple sans aperçu texte** (fix lisibilité)
- **Pulse spring** du perso à l'arrivée

### 4.5 Système XP / Distance marchée *(nouveau — 7 mai 2026)*

- **XPBar** : barre en bas d'écran affichant la distance totale marchée en **lieues**
- La distance est accumulée trajet par trajet dans `totalDistancePx` (persisté en AsyncStorage et synchronisé Firebase)
- La longueur totale du trajet est capturée dans `tripTotalLengthRef` au **départ** (et non à l'arrivée) pour éviter les bugs si le chemin change en cours de route (ex : changement de vitesse)
- `XPBar` s'anime depuis 0 à chaque mise à jour (animation spring)
- **XP affiché dans la modale de fin de trajet** : le gain de distance est animé dans le recap
- `updateMyProfile` est désormais une **Promise** (fix Firebase) ; appel sécurisé avec guard dans `finalizeArrival`
- `joinMultiplayer` restore `totalDistancePx` depuis Firebase pour cohérence cross-session

### 4.6 Multi

- Service abstrait `multiplayer` avec 2 implémentations interchangeables
- **MockMultiplayer** par défaut : 3 joueurs fakes (Théo/Léa/Max) avec mouvement en cycle 1.5s, rebond aux limites
- **FirebaseMultiplayer** : Realtime DB, position throttlée 250ms, `onDisconnect` cleanup auto, à activer via `USE_FIREBASE = true` + config
- **Pseudo** + couleur aléatoire + UUID anonyme
- Affichage live des autres joueurs avec **interpolation 1.4s** entre updates (pour rendu smooth)
- `totalDistancePx` du joueur **syncé dans son profil Firebase** à chaque arrivée

### 4.7 Persistance

- AsyncStorage **debounced 500ms**
- Save : `pos`, `collected`, `coins`, `openedChests`, `visited` (POI), `quests`, `explored` (brouillard), **`totalDistancePx`** *(nouveau)*
- Profil séparé : `id` / `name` / `color`
- Flag `firstLaunch` séparé
- Bouton **reset ↺** (efface tout sauf profil)

### 4.8 Tests (Jest)

- Configuré : env node, `babel preset-env` en mode test uniquement (n'interfère pas avec Expo)
- ~60 tests sur logique pure :
  - **geometry** : distances, lissage, échantillonnage, edge cases (vide, 1 point)
  - **pathfinding** : A* (start=end, contournement mur, rivière+pont obligatoire, diagonales bloquées, connexité du chemin)
  - **random** : déterminisme seedé, distribution, continuité bruit
  - **terrain** : 4 types présents, spawn safe, déterminisme entre runs
  - **poi** : espacement minimum, IDs uniques, passabilité, déterminisme
  - **gameplay** : pickupCoins (rayon, mélange), pickupChests (déjà ouverts ignorés), visitPOIs, brouillard
  - **quests** : création conditionnelle, validation, immutabilité (ne mute pas)
  - **multiplayer** : Mock complet (init, subscribe, tick, dispose, multi-subscribers)

---

## 5. Critique gameplay (limites identifiées)

1. **Pas de raison de jouer long terme** : 10 quêtes max, pas de progression/niveau/déblocages, joueur s'ennuie en 20 min
2. **Attente non récompensée** : 1-5 min pour 1-3 pièces = ennui, faut événements ou raccourcir
3. **Pièces inutiles** : pas de shop, pas d'amélioration, compteur dans le vide
4. **Coffres trop faciles** : 80px du clic, pas de mécanique d'ouverture (clé, énigme)
5. **POI vides** : visite = juste un ✓, pas de PNJ, pas de lore, pas de dialogue
6. **Multi gadget** : voir bouger des points sans aucune interaction réelle (pas d'échange, pas de coop, pas de classement)
7. **Pas de risque ni tension** : walking simulator, pas d'énergie, pas d'ennemi, pas de chrono
8. **Variantes trajet sans impact réel** : rapide vs scénique = même payoff au final
9. **Pas de feedback sensoriel** : pas de son, pas de vibration, pas de particules à l'arrivée
10. **Map peu lisible** : tout vert, pas de biomes marquants (forêt, désert, plage), on ne se souvient pas où on est allé
11. **Pas d'inventaire** : juste un compteur de pièces
12. **XP = distance uniquement** : la XPBar affiche des lieues mais n'est pas encore branchée sur un système de niveau/récompense

---

## 6. Manques pour MVP testable 30+ min

À ajouter pour un test utilisateur sérieux :

- **Shop** dans villages : boosts vitesse, rayon collecte, fragments de carte
- **Système niveau/XP** : chaque trajet donne XP, niveau débloque trucs *(base posée avec totalDistancePx)*
- **PNJ dans POI** : 1 dialogue court par POI + mini-quête déclenchée
- **Événements aléatoires** en route : 20% chance par trajet, choix A/B avec gain/perte
- **Inventaire basique** : pièces, clés, fragments, potions
- **Coffres verrouillés** : nécessitent une clé (loot rare)
- **Énergie / cooldown** : empêche de spammer les trajets longs

Estimation : ~1 semaine de dev pour ce MVP.

---

## 7. Statut actuel

- Code **prêt à tester** via `npm install && npx expo start` → Expo Go
- Tests Jest via `npm test` (pas encore exécutés en bout, mais syntaxe vérifiée)
- Multi en **mode mock** par défaut (Firebase prêt mais nécessite credentials utilisateur)
- APK build dispo via `eas build -p android --profile preview` (compte Expo configuré, projectId actif : `adb81213-682e-45cb-a971-24976671f4a1`)
- **XPBar fonctionnelle** avec distance persistée et synchro Firebase (ajout 7 mai 2026)

---

## 8. Décisions ouvertes pour la suite (à brainstormer)

1. **Lancer alpha fermée 5-10 amis maintenant** pour valider le concept de base avant d'investir plus ?
2. Ou **ajouter d'abord** shop + XP + événements + PNJ avant tout test utilisateur ?
3. **Persistance** : rester local AsyncStorage ou passer cloud (Firebase Auth + Firestore) ?
4. **Multi** : garder mock pour proto ou activer Firebase tout de suite ?
5. **Direction artistique** : rester abstrait/géométrique ou aller vers pixel art / illustré ?
6. **Modèle économique** : free-to-play ? IAP cosmétiques ? Premium one-shot ?
7. **Cycle de jeu** : quelle durée moyenne d'une session ? (1 trajet de 3min ? plusieurs sessions courtes/jour ?)
8. **Compétition vs coopération** : classement global, guildes, raids, ou purement individuel ?
9. **XPBar → Niveaux** : transformer `totalDistancePx` en vrai système de niveaux avec paliers et récompenses ?

---

## 9. Préférences communication utilisateur

- L'utilisateur préfère des **réponses brèves**, optimisées pour minimiser les tokens
- Pas peur d'être direct/froid
- Français
