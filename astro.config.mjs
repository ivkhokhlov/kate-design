// @ts-check
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://katekhokhlova.github.io",
  base: "/kate-design",
  devToolbar: {
    enabled: false
  },
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()]
  }
});
