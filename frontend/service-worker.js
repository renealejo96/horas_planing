// Service Worker para PYGANFLOR - ver 2.0.0
const CACHE_NAME = 'pyganflor-v2.0';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/api.js',
    '/js/app.js',
    '/js/views/dashboard.js',
    '/js/views/planificacion.js',
    '/js/views/planificacion-diaria.js',
    '/js/views/ejecucion.js',
    '/js/views/comparativa.js',
    '/js/views/personal.js',
    '/js/views/rendimientos.js',
    '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[ServiceWorker] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - network first, fallback to cache for API calls
// Cache first for static assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Ignorar requests de extensiones de Chrome u otros schemes no soportados
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // API calls - network only (no cache)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return new Response(
                        JSON.stringify({ error: 'Sin conexión' }),
                        { status: 503, headers: { 'Content-Type': 'application/json' } }
                    );
                })
        );
        return;
    }
    
    // Static assets - cache first
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request)
                    .then((response) => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200) {
                            return response;
                        }
                        
                        // Clone the response
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    });
            })
    );
});

// Push notification event
self.addEventListener('push', (event) => {
    console.log('[ServiceWorker] Push received');
    
    // Icono SVG inline para notificaciones
    const defaultIcon = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%2310B981' width='100' height='100' rx='20'/><text x='50' y='70' text-anchor='middle' font-size='50'>🌿</text></svg>";
    
    let data = { title: 'PYGANFLOR', body: 'Notificación', icon: defaultIcon };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    const options = {
        body: data.body || data.mensaje || 'Tienes una notificación',
        icon: data.icon || defaultIcon,
        vibrate: [200, 100, 200],
        tag: data.tag || 'pyganflor-notification',
        renotify: true,
        data: {
            url: data.url || '/'
        }
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'PYGANFLOR', options)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('[ServiceWorker] Notification click');
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If a window is already open, focus it
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open a new window
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.url || '/');
                }
            })
    );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    console.log('[ServiceWorker] Sync event:', event.tag);
    
    if (event.tag === 'sync-ejecuciones') {
        event.waitUntil(syncPendingEjecuciones());
    }
});

async function syncPendingEjecuciones() {
    // This would sync any pending executions saved in IndexedDB
    // For now, just log
    console.log('[ServiceWorker] Syncing pending executions...');
}
