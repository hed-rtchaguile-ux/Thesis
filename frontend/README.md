# React + Vite

## Deploying to Vercel

Deploy the repository root as the Vercel project root and select the **Other**
framework preset. The root npm workspace builds the Vite frontend into
`frontend/dist`, while `api/[...path].js` routes the existing Express API
through a Vercel Node.js Function.

Configure these environment variables in the Vercel project for Production
(and Preview if needed):

- `MONGODB_URI`
- `APP_AUTH_TOKEN_SECRET`
- `BREVO_API_KEY`
- `SENDER_NAME`
- `SENDER_EMAIL` (must be verified in Brevo)

Use the Brevo API key, not the SMTP key, for `BREVO_API_KEY`. Redeploy after
changing environment variables. Keep credentials out of Git and frontend
variables.

## Public Access

The current temporary public link is:

https://little-bobcats-shout.loca.lt

If LocalTunnel displays a safety page, enter this IP address:

49.150.198.238

The link is available only while the frontend, backend, and LocalTunnel terminals are running. The URL may change when the tunnel is restarted.

Start the services from the project root:

```powershell
cd Thesis\backend
npm.cmd start

cd ..\frontend
npm.cmd run dev -- --port 5174
npx.cmd --yes localtunnel --port 5174
```

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
