// useSpriteAnims — animations ambiantes du sprite personnage.
// - bounce : pulse quand le perso se déplace (loop)
// - breathe : respiration continue (sin in/out)
//
// Retourne : { bounce, breathe }
// Les deux sont des Animated.Value à brancher sur des transforms.

import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export function useSpriteAnims(moving) {
  const bounce = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  // Bounce : pulse pendant le déplacement
  useEffect(() => {
    if (!moving) {
      Animated.timing(bounce, {
        toValue: 0, duration: 150, useNativeDriver: true,
      }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [moving]);

  // Breathe : respiration continue
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
      ]).start(({ finished }) => { if (!cancelled && finished) tick(); });
    };
    tick();
    return () => {
      cancelled = true;
      breathe.stopAnimation();
    };
  }, []);

  return { bounce, breathe };
}
