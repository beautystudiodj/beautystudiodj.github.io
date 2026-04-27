// Firebase config y inicialización directa - proyecto: beautystudio-dj
(function () {
    const cfg = {
        apiKey: "AIzaSyBHipLnuxtYDGT8PIS3ijIobo4iE-zlJDY",
        authDomain: "beautystudio-dj.firebaseapp.com",
        projectId: "beautystudio-dj",
        storageBucket: "beautystudio-dj.firebasestorage.app",
        messagingSenderId: "1027229175042",
        appId: "1:1027229175042:web:d2cd873601e1a2b11ac61b"
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
            console.log('%c Firestore conectado ✓ ', 'background:#188038;color:#fff;padding:2px 6px;border-radius:3px;');
            return true;
        } catch (err) {
            console.warn('Firebase init failed:', err);
            window.__FIRESTORE_READY = false;
            return false;
        }
    })();

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