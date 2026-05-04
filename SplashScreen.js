import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Path, G, Defs, RadialGradient, Stop } from 'react-native-svg';

const { width: W, height: H } = Dimensions.get('window');

export default function SplashScreen({ onDone }) {
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.8)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const compassRotate = useRef(new Animated.Value(0)).current;
  const dotProgress = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Séquence : compass spin → titre → sous-titre → loader → fade out
    Animated.parallel([
      // Boussole tourne en continu
      Animated.loop(
        Animated.timing(compassRotate, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ),
      // Titre fade + scale
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(titleScale, {
            toValue: 1,
            friction: 5,
            tension: 50,
            useNativeDriver: true,
          }),
        ]),
        // Sous-titre apparaît
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Loader animation
        Animated.timing(dotProgress, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        // Fade out total
        Animated.timing(fadeOut, {
          toValue: 0,
          duration: 500,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (onDone) onDone();
      }),
    ]);
  }, []);

  const spin = compassRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.root, { opacity: fadeOut }]}>
      {/* Fond avec halo */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="halo" cx="50%" cy="45%" r="60%">
            <Stop offset="0%" stopColor="#3a4a5e" stopOpacity="1" />
            <Stop offset="100%" stopColor="#1a1a2e" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Circle cx={W / 2} cy={H / 2} r={Math.max(W, H)} fill="url(#halo)" />
      </Svg>

      {/* Boussole en arrière */}
      <Animated.View style={[styles.compassWrap, { transform: [{ rotate: spin }] }]}>
        <Svg width={220} height={220} viewBox="0 0 220 220">
          <Circle cx="110" cy="110" r="95" stroke="#ffd93d" strokeWidth="2" fill="none" opacity={0.4} />
          <Circle cx="110" cy="110" r="80" stroke="#ffd93d" strokeWidth="1" fill="none" opacity={0.25} strokeDasharray="4,8" />
          {/* Aiguille */}
          <G>
            <Path d="M 110 30 L 120 110 L 110 120 L 100 110 Z" fill="#ff6b6b" stroke="#fff" strokeWidth="1" />
            <Path d="M 110 190 L 120 110 L 110 100 L 100 110 Z" fill="#fff" stroke="#1a1a2e" strokeWidth="1" />
            <Circle cx="110" cy="110" r="6" fill="#1a1a2e" stroke="#ffd93d" strokeWidth="2" />
          </G>
          {/* Points cardinaux */}
          <Circle cx="110" cy="20" r="3" fill="#ffd93d" />
          <Circle cx="110" cy="200" r="3" fill="#ffd93d" />
          <Circle cx="20" cy="110" r="3" fill="#ffd93d" />
          <Circle cx="200" cy="110" r="3" fill="#ffd93d" />
        </Svg>
      </Animated.View>

      {/* Titre */}
      <Animated.View style={[styles.titleWrap, {
        opacity: titleOpacity,
        transform: [{ scale: titleScale }],
      }]}>
        <Text style={styles.title}>Treasure Quest</Text>
        <View style={styles.titleUnderline} />
      </Animated.View>

      {/* Sous-titre */}
      <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
        Explore le monde, à ton rythme
      </Animated.Text>

      {/* Loader (3 points) */}
      <Animated.View style={[styles.loaderWrap, { opacity: subtitleOpacity }]}>
        {[0, 1, 2].map((i) => {
          const opacity = dotProgress.interpolate({
            inputRange: [0, 0.33 * i, 0.33 * i + 0.2, 1],
            outputRange: [0.3, 0.3, 1, 1],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={i}
              style={[styles.dot, { opacity }]}
            />
          );
        })}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  compassWrap: {
    position: 'absolute',
    top: '32%',
    opacity: 0.6,
  },
  titleWrap: {
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 40,
  },
  title: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 2,
  },
  titleUnderline: {
    width: 60,
    height: 3,
    backgroundColor: '#ffd93d',
    marginTop: 8,
    borderRadius: 2,
  },
  subtitle: {
    color: '#a8b8c8',
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  loaderWrap: {
    flexDirection: 'row',
    marginTop: 60,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffd93d',
  },
});
