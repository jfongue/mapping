// Config Firebase
// Les vraies valeurs doivent être dans .env (non commité).
// Pour Expo, utiliser app.config.js + expo-constants ou react-native-dotenv.
// Voir .env.example pour les clés attendues.

export const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY             || 'MISSING',
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN         || 'MISSING',
  databaseURL:       process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL        || 'MISSING',
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID          || 'MISSING',
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET      || 'MISSING',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'MISSING',
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID              || 'MISSING',
};
