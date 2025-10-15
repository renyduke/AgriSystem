import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import * as path from 'path'

export default defineConfig({
  ddarkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          background: '#1f2937', // gray-800
          card: '#374 151', // gray-700
          text: '#f3f4f6', // gray-100
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
});
