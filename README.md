# merkgustogym

Web de **MERKGUSTO GYM** (React 18 + Vite + Tailwind + TanStack Query). La API está en el repo `merkgusto-backend`.

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:5173 (proxy /api → http://localhost:5050)
```

## Despliegue en Vercel

1. Importa este repositorio en Vercel (framework **Vite**, se detecta solo; `vercel.json` ya trae la configuración).
2. La URL del backend ya está en `.env.production` (`https://merkgusto-backend-production.up.railway.app`). Si cambia, edítala ahí o define `VITE_API_URL` en Vercel.
3. En el backend, pon la URL de Vercel en `CORS_ORIGIN`.

## Instalación local (sin internet)

Compila con `VITE_API_URL= npm run build` (vacío) y el backend sirve la carpeta `dist` en el mismo puerto.
