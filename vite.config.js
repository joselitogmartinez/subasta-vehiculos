import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],

  build: {
    // Las dependencias se separan en chunks propios: el framework y el
    // cliente de Supabase cambian mucho menos que el codigo de la app, y
    // asi el navegador los reutiliza de su cache entre despliegues.
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase/ },
          ],
        },
      },
    },
  },
})