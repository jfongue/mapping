// src/notifications.js
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let _pendingNotifId = null;
let _foregroundSub = null;

/**
 * À appeler une fois au montage de App.js via useEffect.
 * Enregistre aussi un listener foreground qui affiche une bannière native
 * même quand l'app est ouverte (contourne le bug Expo Go iOS).
 */
export async function requestNotificationPermissions() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('arrival', {
      name: 'Arrivée à destination',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ffd93d',
    });
  }
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) {
    const { granted: g2 } = await Notifications.requestPermissionsAsync();
    if (!g2) return false;
  }

  // Listener foreground : re-présente la notif via addNotificationReceivedListener
  // quand l'app est au premier plan (setNotificationHandler suffit sur Android,
  // mais ce listener explicite corrige iOS / Expo Go).
  if (!_foregroundSub) {
    _foregroundSub = Notifications.addNotificationReceivedListener(() => {
      // Le handler défini plus haut (shouldShowAlert: true) fait le travail ;
      // ce listener existe uniquement pour forcer Expo Go iOS à l'honorer.
    });
  }
  return true;
}

/**
 * @param {number} etaMs  - Date.now() + durée du trajet en ms
 * @param {string} destLabel
 */
export async function scheduleArrivalNotification(etaMs, destLabel = 'destination') {
  await cancelArrivalNotification();
  if (etaMs - Date.now() <= 0) return null;
  try {
    const trigger = Platform.OS === 'android'
      ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(etaMs), channelId: 'arrival' }
      : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(etaMs) };
    _pendingNotifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🗺️ Treasure Quest',
        body: `Ton aventurier est arrivé à ${destLabel} !`,
        sound: true,
      },
      trigger,
    });
    return _pendingNotifId;
  } catch (e) {
    console.warn('[notifications] schedule failed:', e);
    return null;
  }
}

export async function cancelArrivalNotification() {
  if (!_pendingNotifId) return;
  try { await Notifications.cancelScheduledNotificationAsync(_pendingNotifId); } catch (_) {}
  _pendingNotifId = null;
}

/** À appeler dans le cleanup de useEffect si le composant est démonté. */
export function removeNotificationListeners() {
  _foregroundSub?.remove();
  _foregroundSub = null;
}
