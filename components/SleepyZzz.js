// 3 'z' qui montent en boucle, fade in/out, scale, rotation. Stylisé mignon.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export default function SleepyZzz({ x, y }) {
  const z1 = useRef(new Animated.Value(0)).current;
  const z2 = useRef(new Animated.Value(0)).current;
  const z3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const animateOne = (val, delay) => {
      const loop = () => {
        if (cancelled) return;
        val.setValue(0);
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (!cancelled && finished) loop();
        });
      };
      loop();
    };
    animateOne(z1, 0);
    animateOne(z2, 600);
    animateOne(z3, 1200);
    return () => { cancelled = true; };
  }, []);

  const renderZ = (val, size, swayDir, key) => {
    const opacity = val.interpolate({
      inputRange: [0, 0.15, 0.7, 1],
      outputRange: [0, 1, 1, 0],
    });
    const dy = val.interpolate({ inputRange: [0, 1], outputRange: [0, -32] });
    const dx = val.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, swayDir * 8, swayDir * 14],
    });
    const rot = val.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: ['-15deg', '10deg', '-10deg'],
    });
    const scale = val.interpolate({
      inputRange: [0, 0.3, 0.6, 1],
      outputRange: [0.5, 1.3, 1.0, 0.9],
    });
    return (
      <Animated.Text
        key={key}
        style={{
          position: 'absolute',
          color: '#dfe6f5',
          fontWeight: '800',
          fontSize: size,
          textShadowColor: 'rgba(0,0,0,0.5)',
          textShadowRadius: 3,
          textShadowOffset: { width: 1, height: 1 },
          opacity,
          transform: [
            { translateX: Animated.add(Animated.add(x, 6), dx) },
            { translateY: Animated.add(Animated.subtract(y, 22), dy) },
            { rotate: rot },
            { scale },
          ],
        }}
      >
        z
      </Animated.Text>
    );
  };

  return (
    <>
      {renderZ(z1, 12, -1, 'z1')}
      {renderZ(z2, 15, 1, 'z2')}
      {renderZ(z3, 19, -1, 'z3')}
    </>
  );
}
