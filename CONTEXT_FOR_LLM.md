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

- **React Native 0.81.5 + Expo ~54** — single codebase iOS/Android, test via Expo Go
- **React 19.1.0**
- **react-native-svg 15.12.1** — rendu de la map (tiles, pièces, POI, paths)
- **react-native-gesture-handler ~2.28.0** — pan caméra
- **expo-notifications ~0.32.17** — push locales
- **expo-device ~8.0.10**
- **@react-native-async-storage/async-storage 2.2.0** — sauvegarde locale
- **firebase ^11.0.2** — Realtime DB (multi en ligne, désactivé par défaut)
- **lucide-react-native 0.413.0** — icônes UI
- **Jest 29** + **babel-jest** — tests unitaires (env node)

---

## 3. Architecture des fichiers

```
/Mapping/
├── App.js                      # Composant principal (orchestration UI/animations, gestion état global)
├── SplashScreen.js             # Écran chargement animé (boussole + titre + loader)
├── firebase.js                 # Init Firebase + helpers RTDB
├── multiplayer.js              # Re-export pour compatibilité (pointe sur src/multiplayer.js)
├── index.js                    # Entrypoint Expo
├── app.json                    # Config Expo (projectId: adb81213-682e-45cb-a971-24976671f4a1)
├── eas.json                    # Build APK preview
├── babel.config.js             # preset-env en mode test, babel-preset-expo sinon
├── metro.config.js
├── auto-update.sh              # Script LaunchAgent macOS pour pull/restart auto
├── com.treasure.autoupdate.plist  # plist LaunchAgent associé
├──
├── /components/                # Composants React Native (UI pure, pas de logique métier)
│   ├── Adventurer.js           # Sprite personnage (SVG animé, pulse arrivée)
│   ├── AnimatedDottedLine.js   # Ligne pointillée animée (prévisualisation trajet)
│   ├── CustomizeModal.js       # Modal personnalisation pseudo/couleur/avatar
│   ├── DottedTrail.js          # Trajet en pointillés sur la map
│   ├── FogLayer.js             # Overlay brouillard de guerre (SVG, cells non révélées)
│   ├── InventoryModal.js       # Modal inventaire (pièces, clés, fragments, lettres)
│   ├── LetterReadModal.js      # Modal lecture d'une lettre reçue
│   ├── LetterWriteModal.js     # Modal rédaction lettre à un joueur
│   ├── PathOverlay.js          # Overlay du chemin actif sur la map
│   ├── PlayerDetailModal.js    # Modal fiche joueur (clic sur autre joueur)
│   ├── PreviewLayer.js         # Prévisualisation du prochain trajet (avant confirmation)
│   ├── SettingsModal.js        # Modal paramètres (Firebase on/off, reset, infos)
│   ├── SleepyZzz.js            # Animation Zzz sur le perso au repos
│   ├── SmoothEdgeArrow.js      # Flèche directionnelle en bord d'écran
│   ├── TileLayer.js            # Rendu des tuiles de terrain (SVG)
│   ├── TravelBars.js           # Barres de progression trajet + XPBar en bas d'écran
│   ├── TripRecapModal.js       # Modal récap de fin de trajet (mini-map style Strava + gains)
│   ├── TripSummaryModal.js     # Modal résumé de trajet avant départ (choix rapide/scénique)
│   └── XPBar.js                # Barre distance total marchée (lièues, animée)
├──
├── /src/                       # Logique pure (testable, sans React)
│   ├── constants.js            # MAP_SIZE 3000x3000, TILE 50, vitesse 40px/s, types terrain, seeds, storage keys
│   ├── random.js               # mulberry32 PRNG + bruit de valeur 2D
│   ├── geometry.js             # distPointToSegment, distPointToPolyline, sampleAt
│   ├── smoothing.js            # smoothPath Catmull-Rom (tension 0.6) — extrait de geometry
│   ├── terrain.js              # isPassable, nearestPassable (réf. chunkManager)
│   ├── tilemap.js              # Génération du tilemap (montagnes, rivières, ponts)
│   ├── chunkManager.js         # Gestion chunks de terrain (rendu progressif)
│   ├── pathfinding.js          # A* sur grille 60x60 + simplification line-of-sight
│   ├── movement.js             # Calcul durée trajet, tripTotalLengthRef, sélection variante
│   ├── camera.js               # Logique suivi caméra / pan manuel
│   ├── character.js            # État personnage (position, statut, pulse)
│   ├── poi.js                  # generateCoins, generateChests (12), generatePOIs (10)
│   ├── quests.js               # buildInitialQuests, updateQuests (immutable)
│   ├── gameplay.js             # pickupCoins/Chests, visitPOIs, revealedCellsAlongPath
│   ├── multiplayer.js          # MockMultiplayer + FirebaseMultiplayer (RTDB)
│   ├── notifications.js        # Scheduling push locale (expo-notifications)
│   ├── profile.js              # Profil joueur (id, name, color, totalDistancePx)
│   ├── debugMessages.js        # Messages debug/test affichés en dev
│   ├── format.js               # Helpers formatage (lieues, distances, durées)
│   ├── theme.js                # Constantes couleurs / styles partagés
│   ├── /hooks/
│   │   ├── useLoop.js          # Game loop via requestAnimationFrame
│   │   └── usePersistedState.js # useState + AsyncStorage sync
│   └── /__tests__/             # ~60 tests Jest (geometry, pathfinding, random, terrain, poi, gameplay, quests, multiplayer)
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
- **Chunk manager** : rendu progressif des tuiles selon la caméra

### 4.2 Mouvement

- Tap → A* vers `nearestPassable` (cellule passable la plus proche)
- **Lissage Catmull-Rom** (tension 0.6) pour courbes douces (`smoothing.js`)
- Durée = longueur courbe / vitesse (40 px/s), clampée 1-5 min
- Longueur totale capturée dans `tripTotalLengthRef` au **départ** (fix compteur si chemin modifié en route)
- Animation suivant la courbe via `Animated.Value` + listener
- **Caméra suit le perso** pendant déplacement (sauf si user a paneé manuellement)
- **2 variantes de trajet** proposées avant départ :
  - **Rapide** : A* direct
  - **Scénique** : passe par un POI/coffre/coin proche du segment direct (+5% min de longueur)
- **Notification push locale** à l'heure d'arrivée prévue

### 4.3 Économie & contenu

- **Pièces** : 1-2 par zone 400×800 px, ramassées si proches du trajet (rayon 40px)
- **12 coffres** espacés 600px, ouverts à 80px du clic d'arrivée, reward 5-19 pièces (seedé)
- **10 POI nommés** (5 villages, 3 ruines, 2 sanctuaires) avec noms fantasy seedés
- **3 quêtes** auto-tracking : récolter 10 pièces, visiter un village précis, explorer une ruine précise
- **Inventaire** : modal `InventoryModal` (pièces, clés, fragments, lettres)

### 4.4 UX / UI

- **Splash screen animé** : boussole rotative, titre spring scale, loader 3 points, fade out
- **Animation d'entrée map** : fade + scale spring depuis 1.2x
- **Tutoriel premier lancement** : bulle 3.5s puis fade
- **Modal personnalisation** (`CustomizeModal`) : pseudo, couleur, avatar
- **HUD** : compteur pièces, indicateur online (pseudo + nb joueurs), bouton settings ⚙, bouton recenter ⊕
- **Mini-carte permanente** : terrain simplifié + POI visités + autres joueurs + perso
- **Panneau quêtes** : 3 quêtes max, ✓ animé
- **Brouillard de guerre** persisté (`FogLayer`) : rayon 3 cells, overlay noir 85%
- **TripSummaryModal** : choix rapide/scénique avant départ, prévisualisation du trajet
- **TripRecapModal** : mini-map style Strava (ligne + pièces + start/end), liste gains, XP animé
- **SmoothEdgeArrow** : flèche directionnelle si le perso est hors écran
- **SleepyZzz** : animation Zzz sur le perso au repos
- **Pulse spring** du perso à l'arrivée
- **Lettres entre joueurs** : `LetterWriteModal` / `LetterReadModal` (multi Firebase)
- **PlayerDetailModal** : fiche joueur au clic sur un autre aventurier
- **SettingsModal** : paramètres (toggle Firebase, reset, infos build)

### 4.5 XP / Distance marchée

- **XPBar** (`components/XPBar.js`) : distance totale en lièues, animée spring
- `totalDistancePx` accumulé à chaque arrivée, persisté AsyncStorage + syncé Firebase profil
- `tripTotalLengthRef` capturé au départ pour éviter bug si chemin modifié mid-trip
- `updateMyProfile` est une **Promise** ; appel guardé dans `finalizeArrival`
- `joinMultiplayer` restore `totalDistancePx` depuis Firebase

### 4.6 Multi

- Service abstrait `multiplayer` avec 2 implémentations interchangeables
- **MockMultiplayer** : 3 joueurs fakes (Théo/Léa/Max), mouvement cycle 1.5s, rebond limites
- **FirebaseMultiplayer** : Realtime DB, position throttlée 250ms, `onDisconnect` cleanup, toggle via `SettingsModal`
- Affichage live avec **interpolation 1.4s** (rendu smooth)
- `totalDistancePx` syncé dans le profil Firebase à chaque arrivée
- **Lettres** : envoi/réception entre joueurs via Firebase

### 4.7 Persistance

- `usePersistedState` hook : useState + AsyncStorage sync debounced 500ms
- Save : `pos`, `collected`, `coins`, `openedChests`, `visited`, `quests`, `explored`, `totalDistancePx`
- Profil séparé (`profile.js`) : `id`, `name`, `color`, `totalDistancePx`
- Flag `firstLaunch` séparé
- Reset complet via `SettingsModal` (garde le profil)

### 4.8 Tests (Jest)

- ~60 tests sur logique pure (`src/__tests__/`)
- Couvre : geometry, pathfinding, random, terrain, poi, gameplay, quests, multiplayer
- `npm test` / `npm run test:coverage`

---

## 5. Critique gameplay (limites identifiées)

1. **Pas de raison de jouer long terme** : quêtes limitées, pas de niveaux/déblocages
2. **Attente non récompensée** : 1-5 min pour 1-3 pièces, pas d'événements en route
3. **Pièces peu utiles** : inventaire présent mais pas de shop/amélioration
4. **Coffres trop faciles** : pas de mécanique d'ouverture (clé, énigme)
5. **POI vides** : visite = juste un ✓, pas de PNJ ni lore
6. **Multi superficiel** : lettres dispo mais pas de coop/classement/échange de loot
7. **Pas de risque ni tension** : walking simulator pur
8. **Variantes trajet sans impact réel** : rapide vs scénique = même payoff
9. **Pas de feedback sensoriel** : pas de son, pas de vibration
10. **Map peu lisible** : pas de biomes marquants (forêt, désert, plage)
11. **XP = distance uniquement** : XPBar présente mais pas branchée sur niveaux/récompenses

---

## 6. Manques pour MVP testable 30+ min

- **Shop** dans villages : boosts vitesse, rayon collecte, fragments de carte
- **Système niveau/XP** : paliers sur `totalDistancePx`, déblocages progressifs
- **PNJ dans POI** : 1 dialogue court + mini-quête déclenchée
- **Événements aléatoires** en route : 20% chance, choix A/B avec gain/perte
- **Coffres verrouillés** : nécessitent une clé (loot rare)
- **Énergie / cooldown** : empêche de spammer les trajets longs

Estimation : ~1 semaine de dev pour ce MVP.

---

## 7. Statut actuel

- Code **prêt à tester** via `npm install && npx expo start` → Expo Go
- Tests Jest via `npm test`
- Multi en **mode mock** par défaut, Firebase activable dans `SettingsModal`
- APK : `eas build -p android --profile preview`
- **XPBar fonctionnelle** avec distance persistée et synchro Firebase
- **Lettres entre joueurs** implémentées (Firebase)

---

## 8. Décisions ouvertes pour la suite

1. **Alpha fermée 5-10 amis** maintenant pour valider le concept ?
2. Ou ajouter shop + XP niveaux + événements + PNJ avant tout test utilisateur ?
3. **Persistance** : rester AsyncStorage ou passer Firebase Auth + Firestore ?
4. **Multi** : activer Firebase par défaut ?
5. **Direction artistique** : abstrait/géométrique ou pixel art / illustré ?
6. **Modèle économique** : F2P cosmétiques ? Premium one-shot ?
7. **Cycle de jeu** : quelle durée de session cible ?
8. **Compétition vs coop** : classement, guildes, raids, ou individuel ?
9. **XPBar → Niveaux** : paliers et récompenses sur `totalDistancePx` ?

---

## 9. Préférences communication utilisateur

- Réponses **brèves**, minimiser les tokens
- Direct/froid OK
- Français
