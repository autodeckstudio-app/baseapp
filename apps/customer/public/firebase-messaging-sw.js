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
// The push carries a "notification" block, so the browser shows it itself.
// Only draw one here when it did not (data-only pushes), and always handle taps.
firebase.messaging().onBackgroundMessage((p) => {
  if (p.notification) return;
  const d = p.data || {};
  self.registration.showNotification(d.title || "AutoDeck", { body: d.body || "", icon: "/icon-192.png", data: d });
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      const c = cs[0];
      return c ? c.focus() : self.clients.openWindow("/");
    }),
  );
});
