/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Project site base — required for GitHub Pages at chenho1998.github.io/refund-flow/
  // Change to "/" if deploying to a user/org root site or a custom domain.
  base: "/refund-flow/",
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
