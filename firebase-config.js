// Firebase config y inicialización directa
// Este archivo carga el SDK y deja window.__FIRESTORE_DB__ listo para usar

(function () {
    const cfg = {
        apiKey: "AIzaSyDY4tD7jQDrDortHqJKgwp_C_y4MtGjPmw",
        authDomain: "base-de-datos-6e1e4.firebaseapp.com",
        databaseURL: "https://base-de-datos-6e1e4-default-rtdb.firebaseio.com",
        projectId: "base-de-datos-6e1e4",
        storageBucket: "base-de-datos-6e1e4.firebasestorage.app",
        messagingSenderId: "622391959093",
        appId: "1:622391959093:web:d4abf7f195079348159b7c",
        measurementId: "G-31WHFJP1XH"
    };

    window.__FIREBASE_CONFIG__ = cfg;

    function loadScript(url) {
        return new Promise(function (resolve, reject) {
            if (document.querySelector('script[src="' + url + '"]')) return resolve();
            var s = document.createElement('script');
            s.src = url;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    // Promesa única compartida por todo el sitio
    window.__FIRESTORE_INIT_PROMISE__ = (async function () {
        try {
            await loadScript('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
            await loadScript('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js');
            if (!window.firebase) throw new Error('Firebase SDK no disponible');
            if (!window.firebase.apps || window.firebase.apps.length === 0) {
                window.firebase.initializeApp(cfg);
            }
            window.__FIRESTORE_DB__ = window.firebase.firestore();
            window.__USE_FIRESTORE__ = true;
            window.__FIRESTORE_READY = true;
            console.log('%c Firestore conectado ', 'background:#188038;color:#fff;padding:2px 6px;border-radius:3px;');
            return true;
        } catch (err) {
            console.warn('Firebase init failed:', err);
            window.__FIRESTORE_READY = false;
            return false;
        }
    })();

    // waitForFirestore ahora simplemente devuelve la promesa ya iniciada
    window.waitForFirestore = function () {
        return window.__FIRESTORE_INIT_PROMISE__;
    };

    window.writeProductToFirestore = async function (product) {
        const ok = await window.__FIRESTORE_INIT_PROMISE__;
        if (!ok) return null;
        const ref = await window.__FIRESTORE_DB__.collection('products').add(product);
        return Object.assign({ id: ref.id }, product);
    };

    window.bulkUpdateFirestore = async function (updates) {
        const ok = await window.__FIRESTORE_INIT_PROMISE__;
        if (!ok) return false;
        const db = window.__FIRESTORE_DB__;
        const batch = db.batch();
        updates.forEach(function (u) {
            batch.update(db.collection('products').doc(u.id), { stock: u.stock });
        });
        await batch.commit();
        return true;
    };

    window.deleteProductFirestore = async function (id) {
        const ok = await window.__FIRESTORE_INIT_PROMISE__;
        if (!ok) return false;
        await window.__FIRESTORE_DB__.collection('products').doc(id).delete();
        return true;
    };
})();