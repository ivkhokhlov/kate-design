// @ts-check
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  devToolbar: {
    enabled: false
  },
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()]
  }
});
