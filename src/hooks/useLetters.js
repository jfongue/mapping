// useLetters — gère les lettres au sol (subscribe Firebase) + écriture + lecture.
//
// Inputs : { profile, pos }
//   profile : profil joueur (pour filter ses propres lettres, signer drops)
//   pos     : position courante (pour drop letter à l'endroit du joueur)
//
// Retourne :
//   letters, writeOpen, setWriteOpen, draft, setDraft,
//   readingLetter, setReadingLetter,
//   openWrite, sendLetter, closeReadingLetter,
//   findLetterNearPoint

import { useCallback, useEffect, useState } from 'react';
import { subscribeLetters, dropLetter, consumeLetter } from '../../firebase';
import { LETTER_PICKUP_RADIUS } from '../constants';

export function useLetters({ profile, pos }) {
  const [letters, setLetters] = useState([]);
  const [writeOpen, setWriteOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [readingLetter, setReadingLetter] = useState(null);

  // Subscribe Firebase
  useEffect(() => {
    let unsub;
    try {
      unsub = subscribeLetters(setLetters);
    } catch (e) {
      if (__DEV__) console.warn('[letters] subscribe failed', e);
    }
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const findLetterNearPoint = useCallback(
    (px, py, radius = LETTER_PICKUP_RADIUS) => {
      let best = null, bestD = radius;
      for (const l of letters) {
        if (!profile || l.authorId === profile.id) continue;
        const d = Math.hypot(l.x - px, l.y - py);
        if (d < bestD) { bestD = d; best = l; }
      }
      return best;
    },
    [letters, profile]
  );

  const openWrite = useCallback(() => {
    setDraft('');
    setWriteOpen(true);
  }, []);

  const sendLetter = useCallback(async () => {
    const text = (draft || '').trim();
    if (!text || !profile) return;
    setWriteOpen(false);
    setDraft('');
    try {
      await dropLetter({
        authorId: profile.id,
        authorName: profile.name,
        authorColor: profile.color,
        x: pos.x, y: pos.y, text,
      });
    } catch (e) {
      if (__DEV__) console.warn('[letters] drop failed', e);
    }
  }, [draft, profile, pos.x, pos.y]);

  const closeReadingLetter = useCallback(async () => {
    const l = readingLetter;
    setReadingLetter(null);
    if (l?.id) {
      try { await consumeLetter(l.id); }
      catch (e) { if (__DEV__) console.warn('[letters] consume failed', e); }
    }
  }, [readingLetter]);

  return {
    letters,
    writeOpen, setWriteOpen,
    draft, setDraft,
    readingLetter, setReadingLetter,
    openWrite, sendLetter, closeReadingLetter,
    findLetterNearPoint,
  };
}
