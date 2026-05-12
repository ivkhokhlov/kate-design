# Екатерина Хохлова

Portfolio site for UX/UI designer Екатерина Хохлова. The content was adapted from the source Notion portfolio into Astro pages and MDX case studies.

## Stack

- Astro + TypeScript
- Tailwind CSS via `@tailwindcss/vite`
- MDX files loaded through Astro content collections
- GSAP + ScrollTrigger for page motion
- Static deploy target for Vercel or Netlify

## Commands

```sh
npm install
npm run dev
npm run build
```

Case studies live in `src/content/work/*.mdx`, and their schema is defined in `src/content.config.ts`.
Localized portfolio images live in `public/images/notion`.
