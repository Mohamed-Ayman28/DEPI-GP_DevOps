# Local container foundation

The root `docker-compose.yml` runs the existing application without replacing it:

- `frontend`: Angular production build served by Nginx
- `backend`: existing FastAPI application
- `mysql`: local MySQL database with persistent storage

To start the stack:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open `http://localhost:4200` for the frontend and
`http://localhost:8000` for the backend health response.

The database initialization script is intended only for a fresh local volume.
Production migrations will be introduced separately and must not rely on
container startup initialization.
