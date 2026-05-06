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
  if (granted) return true;
  const { granted: g2 } = await Notifications.requestPermissionsAsync();
  return g2;
}

/**
 * @param {number} etaMs  - Date.now() + durée du trajet
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
