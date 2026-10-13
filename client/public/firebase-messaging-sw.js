importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
        }).then(() => clients.claim())
    );
});

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

firebase.initializeApp({
    apiKey: "AIzaSyCPWTTudaVUIa8ZYJA6BE8SiWALq3RzAwQ",
    authDomain: "traverse-unicab.firebaseapp.com",
    projectId: "traverse-unicab",
    storageBucket: "traverse-unicab.firebasestorage.app",
    messagingSenderId: "224752732964",
    appId: "1:224752732964:web:89aff5f0aa1a505aa081b1"
});

const messaging = firebase.messaging();

// Sound in notification options is supported on Android Chrome.
// Note: iOS has limitations with web push sound.
messaging.onBackgroundMessage((payload) => {
    const title = payload.data?.title || payload.notification?.title || 'Traverse';
    const body = payload.data?.body || payload.notification?.body || 'New ride request available!';
    self.registration.showNotification(title, {
        body: body,
        icon: '/traverse-logo.jpeg',
        badge: '/traverse-logo.jpeg',
        sound: '/notification.wav',
        vibrate: [300, 100, 300, 100, 300],
        requireInteraction: true,
        tag: 'new-ride',
        renotify: true,
        actions: [
            { action: 'accept', title: '✅ Open App' },
            { action: 'dismiss', title: '❌ Dismiss' }
        ]
    });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});
