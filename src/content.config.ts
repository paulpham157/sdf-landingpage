import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      summary: z.string(),
      hero: image().optional(),
      heroAlt: z.string().optional(),
      tags: z.array(z.string()).default([]),
      /** Specimens shipped with the site. Real posts leave this false. */
      sample: z.boolean().default(false),
      /** Drafts are omitted from the index, the post route, and the sitemap. */
      draft: z.boolean().default(false),
    }),
});

export const collections = { blog };
