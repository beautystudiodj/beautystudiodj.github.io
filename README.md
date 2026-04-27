# beautystudiodj.github.io
Sitio web oficial de D&amp;J Beauty Studio

Firebase integration
--------------------
This project can use Firebase Firestore as a shared database for products. To enable Firestore:

1. Create a Firebase project at https://console.firebase.google.com and enable Firestore (in production choose proper security rules).
2. Copy the web app configuration (the firebase config object) and expose it to your pages. Two options:

Option A - global JS (recommended): add this in the `<head>` of your pages before other scripts:

```html
<script>
	window.__FIREBASE_CONFIG__ = {
		apiKey: "...",
		authDomain: "...",
		projectId: "...",
		storageBucket: "...",
		messagingSenderId: "...",
		appId: "..."
	};
</script>
```

Option B - meta tag (JSON):

```html
<meta name="firebase-config" content='{"apiKey":"...","authDomain":"...","projectId":"..."}'>
```

3. Firestore collection: use a collection named `products`. Documents should contain fields: `eyebrow`, `title`, `price`, `stock`, `image`, `description`.

Once configured, the frontend will connect to Firestore and show the same products to all visitors in real time. Admin pages will write to Firestore when available.

Security note: the Firebase config object is public by design; protect write operations with Firestore rules or add authentication for the admin panel.

