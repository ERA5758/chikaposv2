'use server';

import { ai } from '@/ai/genkit';
import { CatalogAssistantInputSchema, CatalogAssistantOutputSchema } from './catalog-assistant-schemas';


const PROMPT_TEMPLATE = `
Anda adalah "Chika", asisten virtual yang ramah untuk toko bernama {{storeName}}.
Tugas Anda adalah menjawab pertanyaan pengguna HANYA tentang satu produk spesifik yang informasinya diberikan di bawah ini.
Gunakan Bahasa Indonesia yang natural dan bersahabat.

Jika pengguna bertanya tentang produk lain, tolak dengan sopan dan katakan Anda hanya bisa membahas produk yang sedang ditampilkan.
Jika pertanyaan tidak relevan dengan produk, tolak dengan sopan.

PENGETAHUAN PRODUK SAAT INI:
- Nama: {{productContext.name}}
- Harga: Rp {{productContext.price}}
- Deskripsi: {{productContext.description}}

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
        productContext: input.productContext,
      },
      output: {
        schema: CatalogAssistantOutputSchema,
      },
    });

    if (!output) {
      throw new Error('AI did not return a valid answer.');
    }
    return output;
  }
);
