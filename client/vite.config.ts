import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiHost = env.VITE_API_HOST || "127.0.0.1";
  const apiPort = env.VITE_API_PORT || env.API_PORT || "3001"; // default aligns with server

  const target = `http://${apiHost}:${apiPort}`;

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        "/api": target,
        "/health": target,
        "/ollama": {
          target: "http://10.246.97.159:11434",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ollama/, "")
        }
      }
    }
  };
});
