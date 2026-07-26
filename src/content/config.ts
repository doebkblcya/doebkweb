import { defineCollection, z } from "astro:content";

const docs = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.date(),
    updated: z.date().optional(),
    category: z.string(),
    summary: z.string(),
    draft: z.boolean().default(false),
    listed: z.boolean().default(true),
  }),
});

export const collections = { docs };
