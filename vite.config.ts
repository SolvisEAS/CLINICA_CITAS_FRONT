import { fileURLToPath } from 'node:url'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Fija el directorio de .env al del propio proyecto: si el dev server
  // se lanza con un cwd distinto (por ejemplo "npm --prefix"), Vite no
  // cambia su cwd real y terminaría leyendo el .env equivocado.
  envDir: projectRoot,
})
