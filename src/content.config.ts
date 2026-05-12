import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const work = defineCollection({
  loader: glob({ base: "./src/content/work", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    client: z.string(),
    year: z.number(),
    duration: z.string().optional(),
    role: z.string(),
    type: z.string(),
    summary: z.string(),
    links: z
      .array(
        z.object({
          label: z.string(),
          href: z.string()
        })
      )
      .default([]),
    caseSummary: z
      .array(
        z.object({
          label: z.string(),
          title: z.string(),
          body: z.string()
        })
      )
      .default([]),
    heroImage: z.string().min(1),
    accent: z.string(),
    featured: z.boolean().default(false),
    order: z.number(),
    services: z.array(z.string()),
    metrics: z.array(
      z.object({
        label: z.string(),
        value: z.string()
      })
    )
  })
});

export const collections = { work };
