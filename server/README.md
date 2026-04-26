Local API server for development

1. Install dependencies

```bash
cd server
npm install
```

2. Run the server

```bash
npm start
# Opens at http://localhost:3000 and serves the static site + API endpoints
```

API endpoints:
- GET  /api/products
- POST /api/products
- PUT  /api/products/:id
- POST /api/products/bulk-stock  (body: { updates: [{id, stock}, ...] })
- DELETE /api/products/:id

The server stores data in `server/db.json`.

If your static site is hosted separately (for example GitHub Pages) and the API is on a different host, add a meta tag to your HTML pages to point the frontend to the API server, e.g. in your `<head>`:

```html
<meta name="api-base" content="https://your-api-host.example.com">
```

The client code will then call `https://your-api-host.example.com/api/...` instead of the local `/api/...` paths.

Alternatively you can set a global JS variable before other scripts run:

```html
<script>window.__API_BASE__ = 'https://your-api-host.example.com'</script>
```

