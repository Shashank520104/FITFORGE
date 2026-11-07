# FITFORGE Web App

Responsive React/Vite application for registration/login, training-plan CRUD, exercise discovery, user-entered nutrition logging, and progress entry/analytics. The app calls the API Gateway; it does not connect directly to service databases.

## Local development

Start the FITFORGE services and API Gateway first, then:

```powershell
npm ci
npm run dev
```

Vite proxies `/api` requests to `http://localhost:3000`; the app runs at `http://localhost:5173`.

## Production container

The Nginx image serves the Vite build on port 8080 and reverse-proxies `/api/` to the Compose API Gateway. The local Compose app is available at `http://localhost:8080`.

## Current UI boundaries

- The AI assistant shows an explicit unavailable state until grounded retrieval is implemented.
- Training plans can be created, listed, and deleted. Active session execution/history is not available yet.
- Nutrition values must be entered with a source label; no sample or inferred food values are shipped.
- Progress charts and summaries render only measurements or strength records entered by the signed-in user.
- Profile preferences are not editable until a profile service exists.
