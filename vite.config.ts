import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri-tuned Vite config: fixed port for the webview, don't watch Rust output.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
});
