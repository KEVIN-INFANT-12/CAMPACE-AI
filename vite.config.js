import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  publicDir: "public",
  server: { host: true, port: 8080, strictPort: true },
  preview: { host: true, port: 8080, strictPort: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        officerLogin: resolve(__dirname, "officer-login.html"),
        officerDashboard: resolve(__dirname, "officer-dashboard.html"),
        studentLogin: resolve(__dirname, "student-login.html"),
        studentRegister: resolve(__dirname, "student-register.html"),
        studentDashboard: resolve(__dirname, "student-dashboard.html"),
      },
    },
  },
});