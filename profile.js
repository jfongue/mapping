// Génération et identité du joueur.
import { PLAYER_COLORS, ANIMAL_NAMES } from './constants';

export const genPlayerId = () =>
  'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const randomName = () =>
  `${ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)]} ${Math.floor(Math.random() * 999)}`;

export const randomColor = () =>
  PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];

export const generateProfile = () => ({
  id: genPlayerId(),
  name: randomName(),
  color: randomColor(),
});

// Online si lastSeen récent.
export const isPlayerOnline = (player, now, thresholdMs) =>
  !!player.lastSeen && (now - player.lastSeen) < thresholdMs;

// Position courante d'un joueur (depuis target ou pos figée).
export const currentPlayerPos = (player, lerpFromTargetFn, now = Date.now()) => {
  if (player.target) {
    const lerped = lerpFromTargetFn(player.target, now);
    if (lerped) return { x: lerped.x, y: lerped.y };
  }
  return { x: player.x, y: player.y };
};
