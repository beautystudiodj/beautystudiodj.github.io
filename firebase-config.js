// firebase-config.js - D&J Beauty Studio
// Inicializa Firebase y Firestore directamente al cargar la pagina

(function () {
    var cfg = {
        apiKey: "AIzaSyBHipLnuxtYDGT8PIS3ijIobo4iE-zlJDY",
        authDomain: "beautystudio-dj.firebaseapp.com",
        projectId: "beautystudio-dj",
        storageBucket: "beautystudio-dj.firebasestorage.app",
        messagingSenderId: "1027229175042",
        appId: "1:1027229175042:web:d2cd873601e1a2b11ac61b"
    };

    window.__FIREBASE_CONFIG__ = cfg;
    window.__FIRESTORE_DB__ = null;
    window.__FIRESTORE_READY = false;

    function loadScript(url) {
        return new Promise(function (resolve, reject) {
            if (document.querySelector('script[src="' + url + '"]')) return resolve();
            var s = document.createElement('script');
            s.src = url;
            s.onload = resolve;
            s.onerror = function () { reject(new Error('No se pudo cargar: ' + url)); };
            document.head.appendChild(s);
        });
    }

    window.__FIRESTORE_INIT_PROMISE__ = Promise.resolve()
        .then(function () { return loadScript('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js'); })
        .then(function () { return loadScript('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js'); })
        .then(function () {
            if (!window.firebase) throw new Error('Firebase SDK no disponible');
            if (!window.firebase.apps || window.firebase.apps.length === 0) {
                window.firebase.initializeApp(cfg);
            }
            var db = window.firebase.firestore();
            window.__FIRESTORE_DB__ = db;
            window.__FIRESTORE_READY = true;
            console.log('%c[DJ] Firestore listo ', 'background:#188038;color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold;');
            return true;
        })
        .catch(function (err) {
            console.error('[DJ] Firebase init error:', err.message);
            window.__FIRESTORE_READY = false;
            return false;
        });

    // Cualquier script puede hacer: await window.waitForFirestore()
    window.waitForFirestore = function () {
        return window.__FIRESTORE_INIT_PROMISE__;
    };

    // Agregar producto
    window.writeProductToFirestore = async function (product) {
        var ok = await window.__FIRESTORE_INIT_PROMISE__;
        if (!ok || !window.__FIRESTORE_DB__) return null;
        var ref = await window.__FIRESTORE_DB__.collection('products').add(product);
        return Object.assign({ id: ref.id }, product);
    };

    // Actualizar stock en lote
    window.bulkUpdateFirestore = async function (updates) {
        var ok = await window.__FIRESTORE_INIT_PROMISE__;
        if (!ok || !window.__FIRESTORE_DB__) return false;
        var db = window.__FIRESTORE_DB__;
        var batch = db.batch();
        updates.forEach(function (u) {
            batch.update(db.collection('products').doc(u.id), { stock: u.stock });
        });
        await batch.commit();
        return true;
    };

    // Eliminar producto
    window.deleteProductFirestore = async function (id) {
        var ok = await window.__FIRESTORE_INIT_PROMISE__;
        if (!ok || !window.__FIRESTORE_DB__) return false;
        await window.__FIRESTORE_DB__.collection('products').doc(id).delete();
        return true;
    };

})();
