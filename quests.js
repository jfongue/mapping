// Système de quêtes pur (sans React).

// Construit les quêtes initiales à partir des POI générés.
export function buildInitialQuests(pois) {
  const village = pois.find((p) => p.type === 'village');
  const ruin = pois.find((p) => p.type === 'ruin');
  return [
    { id: 'q1', title: 'Récolter 10 pièces', goal: 10, type: 'coins', done: false },
    village && { id: 'q2', title: `Visiter ${village.name}`, target: village.id, type: 'visit', done: false },
    ruin && { id: 'q3', title: `Explorer ${ruin.name}`, target: ruin.id, type: 'visit', done: false },
  ].filter(Boolean);
}

// Met à jour les quêtes selon état actuel.
// Pure : ne mute rien, renvoie un nouveau tableau.
export function updateQuests(quests, { totalCoins, visitedSet }) {
  return quests.map((q) => {
    if (q.done) return q;
    if (q.type === 'coins' && totalCoins >= q.goal) return { ...q, done: true };
    if (q.type === 'visit' && visitedSet.has(q.target)) return { ...q, done: true };
    return q;
  });
}
