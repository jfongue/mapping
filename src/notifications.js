// src/notifications.js
// Gestion des notifications push locales pour Treasure Quest.
// Utilisé uniquement pour notifier l'arrivée à destination.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure le handler pour afficher la notif même si l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Identifiant unique pour la notif d'arrivée (on n'en a qu'une à la fois)
const ARRIVAL_NOTIF_ID_KEY = '__tq_arrival_notif_id__';
let _pendingNotifId = null;

/**
 * Demande les permissions de notification.
 * À appeler au démarrage de l'app (une fois).
 * Retourne true si accordées, false sinon.
 */
export async function requestNotificationPermissions() {
  if (Platform.OS === 'android') {
    // Android 13+ nécessite une permission explicite
    await Notifications.setNotificationChannelAsync('arrival', {
      name: 'Arrivée à destination',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ffd93d',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Programme une notification locale à l'heure d'arrivée prévue.
 * Annule automatiquement l'éventuelle notif précédente.
 *
 * @param {number} etaMs  - timestamp ms de l'arrivée (Date.now() + durée)
 * @param {string} destLabel - label de la destination (ex: "45, 32")
 * @returns {Promise<string|null>} identifiant de la notif planifiée
 */
export async function scheduleArrivalNotification(etaMs, destLabel = 'destination') {
  // Annule la notif précédente si elle existe encore
  await cancelArrivalNotification();

  const secondsUntilArrival = Math.round((etaMs - Date.now()) / 1000);
  if (secondsUntilArrival <= 0) return null;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🗺️ Treasure Quest',
        body: `Ton aventurier est arrivé à ${destLabel} !`,
        sound: false,
        ...(Platform.OS === 'android' && { channelId: 'arrival' }),
      },
      trigger: {
        seconds: secondsUntilArrival,
        // type: 'timeInterval' est implicite pour expo-notifications avec `seconds`
      },
    });
    _pendingNotifId = id;
    return id;
  } catch (e) {
    console.warn('[notifications] scheduleArrivalNotification failed:', e);
    return null;
  }
}

/**
 * Annule la notification d'arrivée en cours, si elle existe.
 * À appeler lorsque le trajet est interrompu manuellement.
 */
export async function cancelArrivalNotification() {
  if (_pendingNotifId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(_pendingNotifId);
    } catch (_) {}
    _pendingNotifId = null;
  }
}
