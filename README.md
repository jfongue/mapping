# Treasure Quest Proto

## Lancer

```bash
npm install
npx expo start
```

Scanner le QR avec **Expo Go** (iOS/Android).

## Multi en ligne

Par défaut : mode **mock** (3 joueurs simulés en local).

Pour activer le **vrai multi** (joueurs réels via Firebase) :

1. Crée un projet Firebase : https://console.firebase.google.com
2. Active **Realtime Database** en mode test
3. Récupère la config Web (clés API)
4. Édite `multiplayer.js` :
   - Remplis `FIREBASE_CONFIG`
   - Mets `USE_FIREBASE = true`
5. Reload — tous les utilisateurs verront les autres en temps réel

## Test

- Glisse pour scroller la map
- Tape une zone : 2 trajets proposés (rapide/scénique)
- Choisis et "Partir" : déplacement live
- Notif locale + rapport à l'arrivée
- Bouton ↺ pour reset la save

## Features

- Map procédurale 3000×3000 (rivières, ponts, montagnes)
- Pathfinding A* + courbes lissées
- Coffres, POI nommés, quêtes auto-tracking
- Brouillard de guerre persisté
- Mini-carte permanente
- Multi (mock ou Firebase)
- Sauvegarde locale AsyncStorage
- Splash animé + animations d'arrivée

## Notes

- Notifs ne marchent pas sur simulateur iOS, OK sur device réel
- Mode mock : positions joueurs locales, non synchronisées entre tels
