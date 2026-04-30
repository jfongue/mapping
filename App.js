import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  TouchableWithoutFeedback,
  Animated,
  Easing,
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';

// === Config ===
const TILE = 50; // px par case
const MAP_TILES = 60; // 60x60 cases
const MAP_SIZE = TILE * MAP_TILES;
const SPEED_PX_PER_SEC = 40; // ~vitesse perso. 1m = ~10px → 4 m/s irl
const MIN_DURATION = 60 * 1000; // 1 min
const MAX_DURATION = 5 * 60 * 1000; // 5 min

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Notif handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function askNotifPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
}

export default function App() {
  // Position perso (centre map au début)
  const [pos, setPos] = useState({ x: MAP_SIZE / 2, y: MAP_SIZE / 2 });
  const [target, setTarget] = useState(null);
  const [moving, setMoving] = useState(false);
  const [eta, setEta] = useState(null); // timestamp arrivée
  const [now, setNow] = useState(Date.now());

  const animX = useRef(new Animated.Value(MAP_SIZE / 2)).current;
  const animY = useRef(new Animated.Value(MAP_SIZE / 2)).current;

  // Camera (offset du monde dans l'écran). Pan gesture.
  const [camera, setCamera] = useState({
    x: SCREEN_W / 2 - MAP_SIZE / 2,
    y: SCREEN_H / 2 - MAP_SIZE / 2,
  });
  const camStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    askNotifPermission();
  }, []);

  // Tick pour updater le compte à rebours
  useEffect(() => {
    if (!moving) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [moving]);

  // Pan camera
  const onPanEvent = (e) => {
    const { translationX, translationY } = e.nativeEvent;
    setCamera({
      x: camStart.current.x + translationX,
      y: camStart.current.y + translationY,
    });
  };
  const onPanStateChange = (e) => {
    if (e.nativeEvent.state === State.BEGAN) {
      camStart.current = { ...camera };
    }
  };

  // Tap sur map
  const handleTap = (evt) => {
    if (moving) return;
    const { locationX, locationY } = evt.nativeEvent;
    // locationX est relatif à la View Map (qui est translatée par camera)
    const targetX = locationX;
    const targetY = locationY;
    startMove(targetX, targetY);
  };

  const startMove = (tx, ty) => {
    const dx = tx - pos.x;
    const dy = ty - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let duration = (dist / SPEED_PX_PER_SEC) * 1000;
    duration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, duration));

    setTarget({ x: tx, y: ty });
    setMoving(true);
    setEta(Date.now() + duration);

    // Notif programmée
    Notifications.scheduleNotificationAsync({
      content: {
        title: 'Arrivé à destination !',
        body: 'Tu peux relancer un mouvement.',
      },
      trigger: { seconds: Math.max(1, Math.floor(duration / 1000)) },
    });

    Animated.parallel([
      Animated.timing(animX, {
        toValue: tx,
        duration,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
      Animated.timing(animY, {
        toValue: ty,
        duration,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setPos({ x: tx, y: ty });
        setMoving(false);
        setTarget(null);
        setEta(null);
      }
    });
  };

  // Grille (rendue avec views absolues — simple)
  const gridLines = [];
  for (let i = 0; i <= MAP_TILES; i++) {
    // verticales
    gridLines.push(
      <View
        key={`v${i}`}
        style={[styles.gridLineV, { left: i * TILE, height: MAP_SIZE }]}
      />
    );
    // horizontales
    gridLines.push(
      <View
        key={`h${i}`}
        style={[styles.gridLineH, { top: i * TILE, width: MAP_SIZE }]}
      />
    );
  }

  const remaining = eta ? Math.max(0, Math.ceil((eta - now) / 1000)) : 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <View style={styles.container}>
        <PanGestureHandler onGestureEvent={onPanEvent} onHandlerStateChange={onPanStateChange}>
          <Animated.View style={styles.canvas}>
            <TouchableWithoutFeedback onPress={handleTap}>
              <View
                style={[
                  styles.map,
                  {
                    width: MAP_SIZE,
                    height: MAP_SIZE,
                    transform: [{ translateX: camera.x }, { translateY: camera.y }],
                  },
                ]}
              >
                {gridLines}
                {/* Cible */}
                {target && (
                  <View
                    style={[
                      styles.target,
                      { left: target.x - 10, top: target.y - 10 },
                    ]}
                  />
                )}
                {/* Personnage */}
                <Animated.View
                  style={[
                    styles.player,
                    {
                      transform: [
                        { translateX: Animated.subtract(animX, 12) },
                        { translateY: Animated.subtract(animY, 12) },
                      ],
                    },
                  ]}
                />
              </View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </PanGestureHandler>

        {/* HUD */}
        <View style={styles.hud} pointerEvents="none">
          <Text style={styles.hudText}>
            {moving ? `En route — ${mm}:${ss}` : 'Tape sur la map pour bouger'}
          </Text>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', overflow: 'hidden' },
  canvas: { flex: 1 },
  map: {
    backgroundColor: '#2d4a3e',
    position: 'absolute',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  player: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ff6b6b',
    borderWidth: 2,
    borderColor: '#fff',
  },
  target: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ffd93d',
    backgroundColor: 'rgba(255,217,61,0.2)',
  },
  hud: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hudText: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 14,
    fontWeight: '600',
  },
});
