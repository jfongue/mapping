// Hook : Animated.Value qui tourne en boucle [0..1] avec une easing donnée.
// Évite la duplication de code Animated.loop dans App.js.
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export default function useLoop({
  duration = 2000,
  easing = Easing.linear,
  useNativeDriver = true,
  pingPong = false, // si true, va à 1 puis revient à 0
} = {}) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      value.setValue(0);
      const seq = pingPong
        ? Animated.sequence([
            Animated.timing(value, { toValue: 1, duration: duration / 2, easing, useNativeDriver }),
            Animated.timing(value, { toValue: 0, duration: duration / 2, easing, useNativeDriver }),
          ])
        : Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver });
      seq.start(({ finished }) => {
        if (!cancelled && finished) tick();
      });
    };
    tick();
    return () => { cancelled = true; };
  }, [duration, pingPong, useNativeDriver]);

  return value;
}
