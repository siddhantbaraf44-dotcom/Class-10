// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ─── YOUR FIREBASE CONFIG (same as in index.html) ───
const firebaseConfig = {
  apiKey: "AIzaSyCnOcZsJpH7QGJ6WZdpguTFV4oBd0XCCYY",
  authDomain: "my-chat-424e7.firebaseapp.com",
  databaseURL: "https://my-chat-424e7-default-rtdb.firebaseio.com",
  projectId: "my-chat-424e7",
  storageBucket: "my-chat-424e7.firebasestorage.app",
  messagingSenderId: "697741479796",
  appId: "1:697741479796:web:991126a18034b0abffa621"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ─── HANDLE BACKGROUND MESSAGES ────────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw] Background message:', payload);

  const notificationTitle = payload.notification?.title || 'New notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message',
    icon: '/icon.png',          // optional – you can add your own icon
    badge: '/badge.png',        // optional
    vibrate: [200, 100, 200],
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ─── OPTIONAL: HANDLE NOTIFICATION CLICKS ─────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Custom behaviour – e.g., open a specific URL
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.openWindow(urlToOpen)
  );
});