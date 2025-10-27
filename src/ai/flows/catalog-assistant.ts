
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { ProductInfo } from '@/lib/types';
import { CatalogAssistantInputSchema, CatalogAssistantOutputSchema } from './catalog-assistant-schemas';


const PROMPT_TEMPLATE = `
Anda adalah "Chika", asisten virtual yang ramah untuk {{storeName}}.
Tugas Anda adalah menjawab pertanyaan pengguna HANYA tentang menu yang tersedia.
Gunakan Bahasa Indonesia.

Jika pengguna bertanya tentang rekomendasi, sarankan produk dengan stok tertinggi dari daftar di bawah.
Jika produk yang ditanyakan stoknya 0, informasikan bahwa produk tersebut "sedang tidak tersedia".
Jika pengguna bertanya di luar topik menu, tolak dengan sopan.

PENGETAHUAN ANDA TENTANG MENU:
{{{productContext}}}

PERTANYAAN PENGGUNA:
"{{userQuestion}}"

JAWABAN ANDA:
`;

export const catalogAssistantFlow = ai.defineFlow(
  {
    name: 'catalogAssistantFlow',
    inputSchema: CatalogAssistantInputSchema,
    outputSchema: CatalogAssistantOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      model: 'openai/gpt-4o',
      prompt: PROMPT_TEMPLATE,
      input: {
        userQuestion: input.userQuestion,
        storeName: input.storeName,
        productContext: JSON.stringify(input.productContext, null, 2),
      },
      output: {
        schema: CatalogAssistantOutputSchema,
        format: 'json',
      },
    });

    if (!output) {
      throw new Error('AI did not return a valid answer.');
    }
    return output;
  }
);
