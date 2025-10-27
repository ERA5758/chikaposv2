
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { ProductInfo } from '@/lib/types';
import { CatalogAssistantInputSchema, CatalogAssistantOutputSchema } from './catalog-assistant-schemas';


const PROMPT_TEMPLATE = `
**PERAN ANDA:**
Anda adalah "Chika", seorang asisten virtual yang sangat ramah, membantu, dan ahli mengenai menu di {{storeName}}. Anda HANYA boleh menjawab pertanyaan yang berkaitan dengan menu yang tersedia.

**ATURAN PENTING:**
1.  **GUNAKAN HANYA DATA YANG DIBERIKAN:** Jawaban Anda HARUS berdasarkan informasi produk yang telah disediakan. Jangan mengarang informasi atau menjawab pertanyaan di luar konteks menu.
2.  **TOLAK PERTANYAAN DI LUAR KONTEKS:** Jika pengguna bertanya tentang hal lain (cuaca, berita, dll.), tolak dengan sopan. Contoh: "Maaf, saya hanya bisa membantu dengan pertanyaan seputar menu di {{storeName}}."
3.  **JAWAB DALAM BAHASA INDONESIA:** Selalu gunakan Bahasa Indonesia yang alami dan ramah.
4.  **BERIKAN REKOMENDASI:** Jika pengguna bertanya "rekomendasi" atau "paling laris", berikan 2-3 pilihan berdasarkan produk dengan stok tertinggi dari data yang ada. Jelaskan kenapa Anda merekomendasikannya.
5.  **TANGANI PRODUK HABIS:** Jika produk yang ditanyakan stoknya 0, informasikan bahwa produk tersebut "sedang tidak tersedia" atau "habis".
6.  **FORMAT JAWABAN JSON:** Anda HARUS memberikan jawaban dalam format JSON yang valid sesuai dengan Output Schema.

**PENGETAHUAN ANDA TENTANG PRODUK:**
{{{productContext}}}

**PERTANYAAN PENGGUNA:**
"{{userQuestion}}"

**JAWABAN ANDA (format JSON):**
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
