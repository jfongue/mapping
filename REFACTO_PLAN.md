# Plan de refacto App.js — état & suite

Branche : `refacto-claude`.  
App.js : **1320 LOC** (départ 1631, soit -19% déjà fait).  
Objectif final : App.js < 300 LOC, orchestration uniquement.

---

## Hooks déjà extraits

| Hook | Fichier | Notes |
|---|---|---|
| `useFogCharPos` | `src/hooks/useFogCharPos.js` | (existait) |
| `useFogOfWar` | `src/hooks/useFogOfWar.js` | + cleanup unmount, warn dev |
| `useFollowedPlayers` | `src/hooks/useFollowedPlayers.js` | |
| `useInventory` | `src/hooks/useInventory.js` | unreadCount mémoïsé |
| `useBoostSpeed` | `src/hooks/useBoostSpeed.js` | timer cleanup |
| `useSpriteAnims` | `src/hooks/useSpriteAnims.js` | bounce/breathe |
| `useProfile` | `src/hooks/useProfile.js` | App.js conserve wrapper `saveProfile` qui relaye `updateMyProfile` firebase |
| `useLetters` | `src/hooks/useLetters.js` | guard `typeof unsub === 'function'` |

Fichiers déplacés : helpers purs → `src/mapUtils.js`. Constantes → `src/constants.js`.

---

## Inventaire restant dans App.js (lignes au 1320 LOC)

| Bloc | Lignes | Densité | Cible |
|---|---|---|---|
| Caméra (refs anim + pan/pinch) | 81–95, 157–158, 163, 174–202, 458–531 | dense | `useCamera` |
| Position/mouvement | 97–106, 145–155, 591–737 | dense | `useMovement` |
| Multiplayer (join/sub + anims joueurs + helpers tap) | 117–120, 250–392, 533–558 | **dense critique** | `useMultiplayer` |
| Recenter visibility polling 150ms | 399–418 | à virer | `tx`/`ty`/`dx`/`dy` addListener — perf win |
| Initial centering | 420–432 | léger | dans `useCamera` |
| handleTap (mix letter+player+pos) | 561–589 | léger | reste dans App ou `useTap` |
| PlayersListModal inline | 859 (`renderPlayersListModal`) | UI | composant à extraire |
| TripSummary `<Modal>` inline | dans le return JSX | UI | composant à extraire |
| Settings handlers (openSettings/save/toggleDebug) | 834–855 | léger | reste dans App (couple firebase) |

---

## Ordre des prochains commits (groupés pour limiter le nombre)

### Commit A — `useMultiplayer`
**Le plus de valeur** : isole 200 lignes denses + apporte une vraie optimisation.

Source : 117–120, 155, 250–277, 279–392, 533–558.

Hook :
```js
useMultiplayer({ profile, animX, animY, totalDistanceRef, setTotalDistancePx })
  → { otherPlayers, playerAnims, selectedPlayer, setSelectedPlayer,
      isOnline, computePlayerPos,
      findTappedPlayer, findPlayerNearPoint,
      globalNow }
```

⚠️ Optimisation à intégrer **dans la même PR** :
- Mémoriser par playerId dans un `Map<id, prevPayload>` ; ne recalculer `findPath` + `Animated.sequence` **que pour les joueurs qui ont changé** depuis le dernier tick (comparer `lastKey`).
- Cleanup unmount : stop toutes les animations de `playerAnims`, vider le Map.
- Guard `typeof unsub === 'function'` avant unsub.
- Conserver `globalNowRef` interne, exposer un `globalNow` (number ou getter) via le hook.

Notes :
- `joinMultiplayer` retourne `result.totalDistancePx` qui hydrate `setTotalDistancePx`. Soit on passe `setTotalDistancePx` en input (couplage simple), soit le hook expose `onJoinedDistancePx` callback. Choisir l'option callback : plus testable.

### Commit B — `useCamera`
Source : 81–95, 157–158, 163, 174–212, 399–432, 458–531, 740–786.

Hook :
```js
useCamera({ viewport, getCharPos })  // getCharPos: () => ({ x, y })
  → { tx, ty, baseScale, pinchScale, dx, dy,
      onPanGesture, onPanStateChange,
      onPinchGesture, onPinchStateChange,
      onCanvasLayout, setViewport,
      recenter, centerOnPoint, markUserHasPanned,
      showRecenterBtn }
```

⚠️ Remplacements à faire dans la même PR :
1. **Tuer le polling 150ms (l. 399–418)** : ajouter `tx.addListener`/`ty.addListener`/`dx.addListener`/`dy.addListener` (ou un seul sur une dérivée), recompute conditionnel + `setShowRecenterBtn`. Économie : 6.7 ticks/s en moins.
2. Remplacer `animX.__getValue()` / `animY.__getValue()` par `getCharPos()` (passé en arg). Découpler le hook de l'`animX/animY` du mouvement.
3. Initial-centering (420–432) absorbé dans le hook, déclenché par `loaded` + `viewport` passés en deps.

### Commit C — `useMovement`
Le plus couplé. Garder pour la fin.  
Source : 97–106, 145–155, 591–739, 788–832 (random walkable helper).

Hook :
```js
useMovement({
  pos, setPos, animX, animY, profile, speedMul,
  onPickupLetter,        // (item) => void (= addInventoryItem)
  onTotalDistanceUpdate, // (newTotalPx) => void
})
  → { moving, target, eta,
      pendingTarget, setPendingTarget,
      activePath, frozenActivePath, consumedDist,
      tripSummary, dismissTripSummary,
      totalDistancePx,
      startMoveAlongCurve, stopMove,
      confirmMove, cancelMove,
      findRandomWalkableTileNearPlayer }
```

⚠️ Pièges :
- `progressRef.addListener` (l. 620–621) doit **toujours** `removeListener` avant un nouveau `addListener`. Bug latent probable, à corriger pendant l'extraction.
- `currentAnim.current?.stop()` au unmount.
- `pendingPickupRef` est partagé entre `confirmMove` et `finalizeArrival` → géré en closure interne du hook.
- `useEffect [moving]` qui recompute le path quand `speedMul` change (l. 434+) : préserver.
- L'`useEffect` de scheduleArrivalNotification doit déménager ici.

### Commit D — Composants UI
- `<PlayersListModal>` (recréer le fichier supprimé en phase 1, mais en y mettant uniquement la logique d'affichage + onClose + onSelect).
- `<TripSummaryModal>` (idem, recréer propre).
- `<MapCanvas>` : encapsule `Pinch`+`Pan`+`Animated.View`+layers (tile, fog, paths, players, sprite). Reçoit les Animated.Value + handlers + données.
- `<HUDButtons>` : recenter / speed / settings / inventory / letter.

Approche : un seul commit pour tout, ou un par composant si on veut tester entre. Préférence : **un commit groupé**, vu que les composants sont indépendants entre eux.

### Commit E — Phase 4 robustesse transverse
1. `src/storage.js` : wrapper `safeGet(key)` / `safeSet(key, val)` (try/catch + JSON safe + warn). Migrer les `AsyncStorage` restants (`SAVE_KEY`, `TOTAL_DISTANCE_KEY`).
2. Audit final cleanup : tous les `addListener` / `setInterval` / `setTimeout` / `Animated.loop` doivent avoir un teardown.
3. Vérifier toutes les Promise `firebase` ont un `.catch` (sinon, log dev).

---

## Pièges & règles de jeu

1. **`animX.__getValue()` est privé/déprécié.** Préférer un listener qui pousse dans une ref locale (pattern `useFogCharPos`).
2. **Ordre des hooks dans App.js compte** : `useProfile` doit précéder `useMultiplayer` (qui le lit), `useMovement` doit précéder `useCamera` si ce dernier doit savoir où est le perso (alors qu'avec `getCharPos: () => ({x,y})` le couplage est annulé).
3. **`saveProfile` dans App.js est un wrapper** autour de `persistProfile` du hook + `updateMyProfile` firebase. Ne pas remettre dans le hook (le hook reste pur AsyncStorage).
4. **`dropLetter` et `consumeLetter` sont importés deux fois sémantiquement** : depuis `useLetters` (write/pickup direct), mais aussi appelés depuis le code de movement (finalizeArrival fait `consumeLetter` après pickup, et debug message fait `dropLetter`). Ces appels resteront dans `useMovement` (consume) et App.js (debug).
5. **`globalNowRef`** : actuellement un ref bump toutes les 5s. À garder interne à `useMultiplayer` (seul `isOnline` s'en sert vraiment).
6. Avant chaque extraction : **re-`grep -n`** les line ranges, elles shiftent.

---

## Checklist smoke test (à dérouler après chaque commit)

- [ ] App démarre, pas d'erreur console
- [ ] Pinch + pan fonctionnent, bouton recenter apparaît hors écran
- [ ] Tap → preview + confirmation
- [ ] Confirm → personnage bouge, fog s'étend, ETA s'affiche
- [ ] Arrivée → trip summary
- [ ] Ramasse une lettre → apparait dans inventaire (badge unread)
- [ ] Inventaire open/close, mark read, delete
- [ ] Settings change nom → persiste après reload
- [ ] Speed boost (long press)
- [ ] Autres joueurs apparaissent + animent + cleanup quand offline
- [ ] Reload app → pos, profile, fog, inventory persistent

---

## Tableau de bord

| Commit | Effet attendu sur App.js |
|---|---|
| A — useMultiplayer | -150 à -200 LOC + perf win |
| B — useCamera | -150 LOC + perf win (kill polling 150ms) |
| C — useMovement | -200 LOC |
| D — Composants UI | -200 à -300 LOC |
| E — robustesse | ±0 LOC |

Cible finale : **App.js ~250–300 LOC**.
