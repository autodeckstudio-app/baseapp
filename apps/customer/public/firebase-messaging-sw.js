// Web push service worker. Public Firebase web config only (same values the app bundle ships).
importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js");
firebase.initializeApp({
  apiKey: "AIzaSyABYNBxwC7rhZhCMlid9xlVJrKrnLPPsRg",
  authDomain: "autodeck-studio.firebaseapp.com",
  projectId: "autodeck-studio",
  storageBucket: "autodeck-studio.firebasestorage.app",
  messagingSenderId: "24903853329",
  appId: "1:24903853329:web:2bc743dc86aad929d4d8b0",
});
firebase.messaging().onBackgroundMessage((p) => {
  const n = p.notification || {};
  self.registration.showNotification(n.title || "AutoDeck", { body: n.body || "", data: p.data || {} });
});
