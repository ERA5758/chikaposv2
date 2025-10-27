
'use server';
/**
 * @fileOverview An AI agent for searching for product images using Google Custom Search API.
 * - searchImages - A function that returns a list of image URLs based on a query.
 * - ImageSearchInput - The input type for the searchImages function.
 * - ImageSearchResponse - The return type for the searchImages function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import axios, { AxiosError } from 'axios';

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

export const imageSearchFlow = ai.defineFlow(
  {
    name: 'imageSearchFlow',
    inputSchema: ImageSearchInputSchema,
    outputSchema: ImageSearchResponseSchema,
  },
  async ({ query }) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    const cx = process.env.GOOGLE_CSE_ID;

    if (!apiKey || !cx) {
      throw new Error("Kunci API Google (GOOGLE_API_KEY) atau ID Mesin Pencari (GOOGLE_CSE_ID) belum diatur di file .env.local.");
    }

    const url = 'https://www.googleapis.com/customsearch/v1';
    const params = {
      key: apiKey,
      cx: cx,
      q: query,
      searchType: 'image',
      num: 9,
    };

    try {
      const response = await axios.get(url, { params });
      const items = response.data.items || [];

      if (items.length === 0) {
        return { images: [] };
      }

      const images: ImageSearchResponse['images'] = items.map((item: any) => ({
        url: item.link,
        alt: item.snippet || item.title || 'Search result image',
      }));

      return { images };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            if (axiosError.response) {
                const status = axiosError.response.status;
                const data = axiosError.response.data as any;
                const errorMessage = data?.error?.message || 'Tidak ada detail error.';

                if (status === 403) {
                    throw new Error(`Akses Ditolak (Error 403). Kemungkinan besar 'Custom Search API' belum diaktifkan di Google Cloud Console Anda. Detail: ${errorMessage}`);
                } else if (status === 400) {
                    throw new Error(`Permintaan Buruk (Error 400). Kemungkinan GOOGLE_CSE_ID tidak valid atau ada parameter yang salah. Detail: ${errorMessage}`);
                } else {
                    // Handle other HTTP errors with a server-side log
                    console.error(`Google Search API error for query "${query}":`, { status, data });
                    throw new Error(`Gagal mengambil gambar dari Google. Status: ${status}.`);
                }
            } else {
                // Handle network errors or errors without a response
                console.error(`Network or unknown Axios error for query "${query}":`, error.message);
                throw new Error("Gagal terhubung ke layanan pencarian gambar. Periksa koneksi internet Anda.");
            }
        }
        // Fallback for non-Axios errors
        console.error("Error fetching images from Google:", error);
        throw new Error("Gagal mengambil gambar dari Google karena kesalahan yang tidak terduga.");
    }
  }
);
