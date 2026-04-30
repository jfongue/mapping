# Treasure Map Proto

## Lancer

```bash
npm install
npx expo start
```

Scanner le QR avec **Expo Go** (iOS/Android).

## Test

- Glisse pour scroller la map
- Tape une zone : le perso se déplace (1-5 min selon distance)
- Notif locale à l'arrivée
- Relance un mouvement après arrivée

## Notes

- Notifs ne fonctionnent pas sur simulateur iOS, OK sur device réel
- Scope : single-player local, état non persisté (reset à chaque reload)
