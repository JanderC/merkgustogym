# merkgustogym

Web de **MERKGUSTO GYM** (React 18 + Vite + Tailwind + TanStack Query). La API está en el repo `merkgusto-backend`.

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:5173 (proxy /api → http://localhost:5050)
```

## Despliegue en Vercel

1. Importa este repositorio en Vercel (framework **Vite**, se detecta solo; `vercel.json` ya trae la configuración).
2. Variable de entorno: `VITE_API_URL=https://<tu-backend>.up.railway.app` (sin `/api`).
3. En el backend, pon la URL de Vercel en `CORS_ORIGIN`.

## Instalación local (sin internet)

Deja `VITE_API_URL` vacío, ejecuta `npm run build` y el backend sirve la carpeta `dist` en el mismo puerto.
