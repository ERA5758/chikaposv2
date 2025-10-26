
'use server';
/**
 * @fileOverview An AI agent for searching for product images.
 * - searchImages - A function that returns a list of image URLs based on a query.
 * - ImageSearchInput - The input type for the searchImages function.
 * - ImageSearchResponse - The return type for the searchImages function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { randomBytes } from 'crypto';

export const ImageSearchInputSchema = z.object({
  query: z.string().describe('The search query for the product image.'),
});
export type ImageSearchInput = z.infer<typeof ImageSearchInputSchema>;

export const ImageSearchResponseSchema = z.object({
  images: z.array(z.object({
    url: z.string().url().describe('The URL of the found image.'),
    alt: z.string().describe('A brief description of the image.'),
  })),
});
export type ImageSearchResponse = z.infer<typeof ImageSearchResponseSchema>;

export async function searchImages(input: ImageSearchInput): Promise<ImageSearchResponse> {
  return imageSearchFlow(input);
}

// This flow simulates an image search. In a real-world scenario, this would
// call an actual image search API (like Google Images, Unsplash, etc.).
// For this demo, we'll generate placeholder images from picsum.photos using
// the query as a seed to get consistent "random" images for the same query.
export const imageSearchFlow = ai.defineFlow(
  {
    name: 'imageSearchFlow',
    inputSchema: ImageSearchInputSchema,
    outputSchema: ImageSearchResponseSchema,
  },
  async ({ query }) => {
    const imageCount = 9; // Generate 9 image results
    const images: ImageSearchResponse['images'] = [];
    const sanitizedQuery = query.replace(/\s+/g, '-').toLowerCase();

    for (let i = 0; i < imageCount; i++) {
        // Use a more stable method for generating unique IDs on the server
        const uniqueSuffix = randomBytes(4).toString('hex');
        const seed = `${sanitizedQuery}-${i}-${uniqueSuffix}`;
        images.push({
            url: `https://picsum.photos/seed/${seed}/400/400`,
            alt: `A placeholder image for: ${query}`,
        });
    }

    return { images };
  }
);
