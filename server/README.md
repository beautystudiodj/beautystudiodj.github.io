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
