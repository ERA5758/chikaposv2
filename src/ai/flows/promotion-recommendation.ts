
/**
 * @fileOverview An AI agent for generating loyalty promotion recommendations.
 *
 * - getPromotionRecommendations - A function that suggests new or updated loyalty promotions.
 * - PromotionRecommendationInput - The input type for thePromotionRecommendationInput function.
 * - PromotionRecommendationOutput - The return type for the getPromotionRecommendations function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ProductPerformanceInfoSchema = z.object({
    name: z.string(),
    price: z.number(),
    costPrice: z.number(),
    unitsSold: z.number().optional(), // Optional as unsold items won't have this
});

export const PromotionRecommendationInputSchema = z.object({
  businessDescription: z.string().describe('A brief description of the business (e.g., "kafe", "vape store").'),
  activeStoreName: z.string().describe('The name of the store for context.'),
  currentRedemptionOptions: z.array(
    z.object({
      description: z.string(),
      pointsRequired: z.number(),
      isActive: z.boolean(),
    })
  ).describe('A list of the current loyalty redemption options.'),
  topSellingProducts: z.array(ProductPerformanceInfoSchema).describe('A list of the best-selling products this month, including their price and cost.'),
  worstSellingProducts: z.array(ProductPerformanceInfoSchema).describe('A list of the worst-selling products this month, including their price and cost.'),
  unsoldProducts: z.array(ProductPerformanceInfoSchema).describe('A list of products that had zero sales this month, including their price and cost.'),
});
export type PromotionRecommendationInput = z.infer<typeof PromotionRecommendationInputSchema>;

export const RecommendationSchema = z.object({
  title: z.string().describe('A short, catchy title for the recommendation in Indonesian.'),
  description: z.string().describe('A concise, actionable recommendation in Indonesian. This will be the promo description.'),
  justification: z.string().describe('A brief explanation of why this recommendation is being made, in Indonesian.'),
  pointsRequired: z.number().describe('The suggested number of points required for this new promotion.'),
  value: z.number().describe('The suggested value (in Rupiah) of this new promotion, if applicable (e.g., for a discount). For free items, this can be 0.'),
});

export const PromotionRecommendationOutputSchema = z.object({
  recommendations: z.array(RecommendationSchema).describe('A list of 2-3 generated promotion recommendations.'),
});
export type PromotionRecommendationOutput = z.infer<typeof PromotionRecommendationOutputSchema>;


export async function getPromotionRecommendations(
  input: PromotionRecommendationInput
): Promise<PromotionRecommendationOutput> {
  return promotionRecommendationFlow(input);
}

const promptText = `Anda adalah Chika AI, seorang ahli strategi marketing dan promosi untuk sebuah **{{businessDescription}}** bernama **{{activeStoreName}}**.

**Tugas Anda:** Buat 2-3 rekomendasi promo penukaran poin yang cerdas, menguntungkan, dan siap ditampilkan di katalog publik.

**Instruksi Utama:**
1.  **Gunakan Nama Produk Spesifik**: Semua rekomendasi HARUS menggunakan nama produk yang ada di dalam data. Jangan pernah gunakan nama generik.
    - **Contoh Buruk**: "Beli Produk A dan dapatkan Produk B gratis."
    - **Contoh Baik**: "Beli **Chika's Kopi Susu** dan dapatkan **Roti Bakar Cokelat** gratis."
2.  **Analisis Data**: Gunakan data kinerja di bawah ini untuk membuat promo yang strategis.
3.  **Strategi Promo**:
    - **Produk Belum Laku**: Jika ada, buat promo 'pemancing' untuk memperkenalkan produk ini. Contoh: "Dapatkan diskon 50% untuk **[nama produk belum laku]** dengan menukar poin."
    - **Produk Kurang Laris**: Jika ada, buat promo 'bundling' dengan produk terlaris.
    - **Produk Terlaris**: Gunakan sebagai daya tarik utama dalam promo bundling.
4.  **Hitung Keuntungan**: Pertimbangkan harga jual dan harga pokok untuk menyarankan diskon yang tetap masuk akal.
5.  **Output Teks**: Semua teks harus dalam Bahasa Indonesia.

**Data Kinerja untuk Analisis:**
- **Promo Aktif Saat Ini:**
{{#if currentRedemptionOptions.length}}
  {{#each currentRedemptionOptions}}
  - {{description}} (membutuhkan {{pointsRequired}} poin, status: {{#if isActive}}Aktif{{else}}Tidak Aktif{{/if}})
  {{/each}}
{{else}}
  - Belum ada promo penukaran poin yang dibuat.
{{/if}}

- **Produk Terlaris Bulan Ini (Nama, Harga Jual, Harga Pokok):**
{{#if topSellingProducts.length}}
  {{#each topSellingProducts}}
  - {{name}} (Jual: {{price}}, Pokok: {{costPrice}})
  {{/each}}
{{else}}
  - Tidak ada data.
{{/if}}

- **Produk Kurang Laris Bulan Ini (Nama, Harga Jual, Harga Pokok):**
{{#if worstSellingProducts.length}}
  {{#each worstSellingProducts}}
  - {{name}} (Jual: {{price}}, Pokok: {{costPrice}})
  {{/each}}
{{else}}
  - Tidak ada produk yang berkinerja buruk secara signifikan bulan ini.
{{/if}}

- **Produk Belum Terjual Bulan Ini (Nama, Harga Jual, Harga Pokok):**
{{#if unsoldProducts.length}}
  {{#each unsoldProducts}}
  - {{name}} (Jual: {{price}}, Pokok: {{costPrice}})
  {{/each}}
{{else}}
  - Semua produk terjual bulan ini.
{{/if}}

Hasilkan 2-3 rekomendasi promo berdasarkan data dan instruksi di atas.
`;


export const promotionRecommendationFlow = ai.defineFlow(
  {
    name: 'promotionRecommendationFlow',
    inputSchema: PromotionRecommendationInputSchema,
    outputSchema: PromotionRecommendationOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      model: 'openai/gpt-4o',
      prompt: promptText,
      input: input,
      output: {
        schema: PromotionRecommendationOutputSchema,
      },
    });

    if (!output) {
      throw new Error('AI did not return a valid recommendation. The model may have failed to generate a response.');
    }
    return output;
  }
);
