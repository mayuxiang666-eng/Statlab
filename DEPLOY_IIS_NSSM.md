# IIS + NSSM Deployment Guide

## Architecture
- IIS serves the static frontend from `client/dist`.
- IIS reverse-proxies `/api/*` and `/health` to the Node backend on `127.0.0.1:3001`.
- The Node backend runs as `statlab-server.exe` under NSSM.
- The Python ML service runs separately on `127.0.0.1:3002` under NSSM.
- App metadata database is SQLite at `server/db/statlab.sqlite`.

## Important Notes
- This project does **not** require SQL Server/MySQL/Postgres for its own app data.
- Prisma is configured to use SQLite in `server/prisma/schema.prisma`.
- The `SavedConnection` table stores external database connection info for MES/PLC/SQL access.
- Uploaded files and processed files are stored under `server/uploads`.
- DB password encryption now supports `ENCRYPTION_KEY` from environment variables.

## Ports
- Frontend: IIS site on 80 or 443
- Node backend: 3001
- Python ML backend: 3002

## 1. Server Prerequisites
Install these on the Windows server:
1. IIS
2. IIS URL Rewrite
3. IIS Application Request Routing (ARR)
4. Node.js 18 x64
5. Python 3.12 x64
6. NSSM
7. Microsoft Visual C++ Redistributable x64

After ARR install:
1. Open IIS Manager.
2. Click the server node.
3. Open `Application Request Routing Cache`.
4. Click `Server Proxy Settings...`.
5. Enable `Proxy`.

## 2. Build on Your Build Machine
From repo root:
```powershell
npm install
npm run python:install
npm --workspace server run db:push
npm --workspace server run build
npm --workspace client run build
```

Build backend exe:
```powershell
cd server
npm run build:exe
```

Expected output:
- Frontend static files: `client/dist`
- Backend exe: `server/release/statlab-server.exe`

## 3. Files to Copy to the Server
Create this structure on the server, for example `D:\StatLab`:
```text
D:\StatLab
  client\dist
  server\release
  server\db
  server\uploads
  server\assets
  server\samples
  server\python_ml
  logs
```

Copy these folders/files:
- `client/dist/*`
- `server/release/statlab-server.exe`
- `server/db/statlab.sqlite`
- `server/assets`
- `samples`
- `server/python_ml`
- `server/prisma` (recommended for maintenance)
- `server/package.json` (recommended for traceability)

If `server/db/statlab.sqlite` does not exist yet, create an empty `server/db` folder and initialize on the server with Prisma before packaging, or copy the already-initialized file.

## 4. Python ML Service Setup on Server
Create a venv:
```powershell
cd D:\StatLab\server\python_ml
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Manual test:
```powershell
.\.venv\Scripts\python.exe main.py
```

Expected:
- service listens on `127.0.0.1:3002`

## 5. Backend Environment Variables
Set these as system environment variables on the server:
- `PORT=3001`
- `PYTHON_ML_URL=http://127.0.0.1:3002`
- `ENCRYPTION_KEY=replace-with-a-long-random-secret`

Optional if you later change Prisma to env-based DB:
- `DATABASE_URL=file:../db/statlab.sqlite`

## 6. Create NSSM Service for Backend EXE
Example commands:
```powershell
nssm install StatLabServer "D:\StatLab\server\release\statlab-server.exe"
nssm set StatLabServer AppDirectory "D:\StatLab\server\release"
nssm set StatLabServer AppStdout "D:\StatLab\logs\statlab-server.out.log"
nssm set StatLabServer AppStderr "D:\StatLab\logs\statlab-server.err.log"
nssm set StatLabServer Start SERVICE_AUTO_START
nssm start StatLabServer
```

## 7. Create NSSM Service for Python ML
Example commands:
```powershell
nssm install StatLabPythonML "D:\StatLab\server\python_ml\.venv\Scripts\python.exe"
nssm set StatLabPythonML AppParameters "D:\StatLab\server\python_ml\main.py"
nssm set StatLabPythonML AppDirectory "D:\StatLab\server\python_ml"
nssm set StatLabPythonML AppStdout "D:\StatLab\logs\statlab-python.out.log"
nssm set StatLabPythonML AppStderr "D:\StatLab\logs\statlab-python.err.log"
nssm set StatLabPythonML Start SERVICE_AUTO_START
nssm start StatLabPythonML
```

## 8. IIS Site Setup
1. Create folder for site root, for example `D:\StatLab\client\dist`.
2. In IIS create a new site, for example `StatLab`.
3. Physical path points to `D:\StatLab\client\dist`.
4. Bind to your domain, port 80/443.
5. Ensure `web.config` exists in `client/dist` after build.

The repo now includes `client/public/web.config`, so `vite build` will copy it into `client/dist` automatically.

## 9. Firewall
Open only public site ports:
- 80
- 443

Do not expose 3001 or 3002 publicly unless you intentionally need that.

## 10. Validation Checklist
Check locally on the server:
```powershell
curl http://127.0.0.1:3001/api/health
curl http://127.0.0.1:3002/health
```

Then from browser:
1. Open the IIS domain.
2. Confirm frontend loads.
3. Confirm sample dataset import works.
4. Confirm Python-backed algorithms run.
5. Confirm uploads create files under `server/uploads`.
6. Confirm database records persist in `server/db/statlab.sqlite`.

## 11. Common Problems
### 502 from IIS
Usually one of these:
- ARR proxy not enabled
- backend service not running
- backend port not listening on 3001

### Backend starts but DB write fails
Grant modify permission to the Windows service account on:
- `D:\StatLab\server\db`
- `D:\StatLab\server\uploads`
- `D:\StatLab\logs`

### Python algorithms fail
Usually one of these:
- Python NSSM service not running
- `PYTHON_ML_URL` not set correctly
- missing Python wheels from `requirements.txt`

### Saved database passwords fail after move
Use the same `ENCRYPTION_KEY` value consistently after deployment.
Changing it later will make old encrypted passwords unreadable.

## 12. Recommended Production Layout
```text
D:\StatLab
  client\dist
  server\release
  server\db
    statlab.sqlite
  server\uploads
  server\python_ml
    .venv
  logs
```

## 13. Recommended First Deployment Order
1. Install prerequisites
2. Build frontend and backend exe on build machine
3. Copy files to server
4. Create Python venv and install requirements
5. Set environment variables
6. Start Python NSSM service
7. Start backend NSSM service
8. Configure IIS site
9. Test frontend and API
