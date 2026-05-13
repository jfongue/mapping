# Plan de refacto App.js — phases 2 → 4

État courant : `App.js` 1453 LOC. Branche `refacto-claude`.
Objectif final : `App.js` < 250 LOC (orchestration uniquement).

---

## Inventaire ciblé (lignes App.js après phase 1)

| Bloc | Lignes | État | Useable / Refs |
|---|---|---|---|
| Caméra (tx/ty/pan/pinch/scale) | 77–89, 184–223, 539–608, 855–902 | dense | tx,ty,baseScale,pinchScale,lastScale,pinchStartScale,dx,dy,userHasPanned,showRecenterBtn,followRafId,isInitialCenter,pinchAnchor,pinchListenerId |
| Position/Move/Trip | 91–100, 129–137, 224–303, 703–844 | dense | pos,moving,target,eta,animX,animY,currentAnim,moveTarget,activePathRef,frozenActivePath,consumedDist,lastConsumedTick,tripTotalLengthRef,tripStartedAtRef,progressRef,progressListenerId,totalDistancePx,tripSummary,pendingPickupRef |
| Fog | ✅ extrait (`useFogOfWar`) | done | — |
| Profile | 110, 305–419 (≈) | moyen | profile,draftName,settingsOpen |
| Multiplayer (subscribe + anims) | 111–115, 420–530 (≈), 614–650 | dense | otherPlayers,selectedPlayer,playerAnims,globalNowRef |
| Letters | 119–122, 469–530 (≈), 632–701 | moyen | letters,letterWriteOpen,letterDraft,readingLetter |
| Inventory | 124–126, 497–530 (≈) | léger | inventory,inventoryLoaded,inventoryOpen |
| Followed players | 155–183 | léger | followedPlayers,playersListOpen |
| Speed boost | 105–108, 949–963 | léger | speedLvl,speedTimer |
| Debug toggle | 106, 979–990 | léger | debugEnabled |
| Recenter visibility polling (150ms) | 484–495 | **à virer** | bench listener Animated |
| Bounce/Breathe loops | 102–103, 233–254 | léger | bounce,breathe |
| HUD (boutons inline) | ~1051–1453 du JSX | dense | extraire en `<HUDButtons />` |
| PlayersListModal | `renderPlayersListModal` 992+ | inline | extraire fichier |
| TripSummary Modal | inline ~1118+ | inline | extraire fichier |

> Les line ranges sont des estimations actuelles — re-grep avant chaque extraction (`grep -n "useEffect" App.js`).

---

## Ordre d'extraction recommandé

Du plus isolé au plus couplé. **Un commit par étape**, smoke test entre chaque.

### Phase 2 — Hooks (par difficulté croissante)

1. **`useInventory(profile)`** → léger, isolé, AsyncStorage uniquement.
   - In : `profile` (pour gating ?)
   - Out : `{ inventory, addItem, consumeItem, open, setOpen, loaded }`
   - Lignes : 124–126, load/save AsyncStorage scattered, consumeLetter calls.

2. **`useFollowedPlayers()`** → AsyncStorage isolé.
   - Out : `{ followed, toggle, isFollowed }`
   - Lignes : 155–183.

3. **`useBoostSpeed()`** → léger.
   - Out : `{ speedLvl, speedMul, onPressIn, onPressOut }`
   - Lignes : 105–108, 949–963.

4. **`useSpriteAmbientAnims()`** → bounce + breathe loops.
   - Returns `{ bounce, breathe }`.
   - Lignes : 102–103, 233–254.
   - ⚠️ Ajouter cleanup `.stop()` sur unmount.

5. **`useProfile()`** → load/save, gen, update.
   - Out : `{ profile, draftName, setDraftName, saveProfile, validateName }`
   - Lignes : 110, 305–419 (à isoler).

6. **`useLetters({ profile, pos })`** → subscribe + send + pickup.
   - Out : `{ letters, writeOpen, setWriteOpen, draft, setDraft, sendLetter, readingLetter, openLetter, closeLetter }`
   - Lignes : 119–122, ~469–530, 632–701.

7. **`useMultiplayer({ profile })`** → join/leave + sync + anims.
   - Out : `{ otherPlayers, playerAnims, selectedPlayer, setSelectedPlayer, isOnline, computePlayerPos, findTappedPlayer, findPlayerNearPoint }`
   - Lignes : 111–115, 420–530 (sub), 614–650 (helpers tap/near).
   - ⚠️ Mémoriser par playerId, ne recalculer `findPath`+`Animated.sequence` que pour le joueur qui change. Stop anims au unmount.

8. **`useCamera({ viewport })`** → le gros. Inclut pan, pinch, follow loop, recenter, centerOnPoint, markUserHasPanned, showRecenterBtn (via Animated listener, pas polling).
   - Out : `{ tx, ty, baseScale, pinchScale, dx, dy, pinch/pan handlers, recenter, centerOnPoint, markUserHasPanned, showRecenterBtn, onCanvasLayout, viewport }`
   - Lignes : 77–89, 184–223, 539–608, 855–902.
   - ⚠️ **Remplacer le polling 150ms (l. 484–495) par `tx.addListener`/`ty.addListener` + recompute conditionnel.**

9. **`useMovement({ pos, setPos, animX, animY, profile, speedMul, ... })`** → le plus couplé.
   - Out : `{ moving, target, eta, frozenActivePath, consumedDist, tripSummary, dismissTripSummary, startMoveAlongCurve, stopMove, confirmMove, cancelMove, pendingTarget, setPendingTarget, totalDistancePx }`
   - Lignes : 91–100, 129–137, 224–303, 703–844.
   - ⚠️ Cleanup `progress.removeListener`, `currentAnim?.stop()` au unmount.

### Phase 3 — Composants UI

10. **`<PlayersListModal />`** — extraire `renderPlayersListModal()` (ligne ~992+) dans `components/PlayersListModal.js`.
11. **`<TripSummaryModal />`** — extraire le `<Modal>` inline (~1118+) dans `components/TripSummaryModal.js` (le fichier existait, on l'a supprimé en phase 1 — le recréer plus proprement avec props).
12. **`<MapCanvas />`** — encapsule `PinchGestureHandler`+`PanGestureHandler`+`Animated.View`+layers. Reçoit handlers + données en props. Ligne ~1051–1115 du JSX.
13. **`<HUDButtons />`** — recenter / speed / settings / inventory / letter. Bas du JSX.
14. **`<OtherPlayersLayer />`** — boucle sur `otherPlayers` (sprites + labels).
15. **`<LettersOverlay />`** — boucle sur `letters` (icônes au sol).

### Phase 4 — Robustesse transverse

16. Wrapper `src/storage.js` : `safeGet(key)`, `safeSet(key, val)` (try/catch + JSON safe + warn dev). Migrer tous les `AsyncStorage.*` dispersés.
17. `src/firebase.js` : guard `typeof unsub === 'function'` avant appel.
18. Cleanup unmount global : audit final, tous les listeners/anims/timers doivent avoir un teardown.

---

## Signatures pré-conçues (pour aller vite)

```js
// src/hooks/useInventory.js
export function useInventory() {
  return { inventory, addItem, consumeItem, loaded, open, setOpen };
}

// src/hooks/useFollowedPlayers.js
export function useFollowedPlayers() {
  return { followed, toggle, isFollowed };
}

// src/hooks/useBoostSpeed.js
export function useBoostSpeed() {
  return { speedLvl, speedMul, onPressIn, onPressOut };
}

// src/hooks/useProfile.js
export function useProfile() {
  return { profile, draftName, setDraftName, saveProfile, validateName };
}

// src/hooks/useLetters.js
export function useLetters({ profile, pos }) {
  return {
    letters, writeOpen, setWriteOpen, draft, setDraft, sendLetter,
    readingLetter, openLetter, closeLetter,
    findLetterNearPoint,
  };
}

// src/hooks/useMultiplayer.js
export function useMultiplayer({ profile }) {
  return {
    otherPlayers, playerAnims, selectedPlayer, setSelectedPlayer,
    isOnline, computePlayerPos, findTappedPlayer, findPlayerNearPoint,
    globalNow,
  };
}

// src/hooks/useCamera.js
export function useCamera({ viewport }) {
  return {
    tx, ty, baseScale, pinchScale, dx, dy,
    onPanGesture, onPanStateChange, onPinchGesture, onPinchStateChange,
    onCanvasLayout, viewport,
    recenter, centerOnPoint, markUserHasPanned,
    showRecenterBtn,
  };
}

// src/hooks/useMovement.js
export function useMovement({ pos, setPos, animX, animY, profile, speedMul, onArrive }) {
  return {
    moving, target, eta, pendingTarget, setPendingTarget,
    frozenActivePath, consumedDist, totalDistancePx,
    tripSummary, dismissTripSummary,
    startMoveAlongCurve, stopMove, confirmMove, cancelMove,
  };
}
```

---

## Pièges identifiés (à ne pas rater)

1. **Couplage `animX`/`animY` ↔ caméra** : `useCamera` n'a pas besoin d'eux directement pour pan/pinch, mais `recenter`/`centerOnPoint`/`startFollowLoop` les lisent en `__getValue()`. → Passer `getCharPos: () => ({x,y})` en arg pour découpler.
2. **`progressRef.addListener`** (l. 732) accumule des callbacks si `startMoveAlongCurve` est appelé plusieurs fois. Vérifier que `removeListener` est bien fait avant le nouveau `addListener`. Bug latent probable.
3. **`pendingPickupRef`** (l. 703) couplé entre `confirmMove` et `finalizeArrival` — passer via closure dans `useMovement`.
4. **`globalNowRef`** est consulté par `isOnline` partout. Soit le passer en arg de `useMultiplayer`, soit dériver d'un `useGlobalNow()` minimaliste.
5. **`__getValue()`** sur `Animated.Value` est privé/déprécié. Préférer `addListener` + ref locale dans les hooks (pattern déjà utilisé par `useFogCharPos`).
6. **`Modal` inline non extraits** : `tripSummaryModal` et `playersListModal` n'ont pas de fichier — ne pas oublier de créer les composants.

---

## Checklist smoke test (après chaque hook extrait)

- [ ] App démarre sans crash, pas d'erreur console rouge
- [ ] Tap sur la map → preview + bar de confirmation
- [ ] Confirmation → personnage se déplace, fog s'étend
- [ ] Pinch + pan fonctionnent, recenter apparaît hors écran
- [ ] Bouton recenter recentre + cache
- [ ] Settings open/close, changement de nom persiste
- [ ] Speed boost (long press) change la vitesse
- [ ] Inventory open/close
- [ ] Autres joueurs apparaissent et bougent (si online)
- [ ] Fermer/rouvrir l'app → pos, profile, fog, inventory persistent

---

## Conseils d'exécution pour la prochaine session

- **Re-grep avant chaque extraction** : les lignes shiftent à chaque commit.
- **Un hook = un commit** atomique. Branche déjà en place : `refacto-claude`.
- **Tester compile** entre chaque (`npx expo start` ou `npm run lint`).
- **Ne pas changer de comportement** : refacto pur d'abord, perfs/robustesse en phase 4 dédiée.
- **Si bloqué** : isoler le hook avec ses dépendances brutes (passer 10 args si besoin), simplifier la signature en phase 4.
- Toutes les **constantes** sont déjà dans `src/constants.js`. Les **helpers purs** dans `src/mapUtils.js`. Réutiliser.
