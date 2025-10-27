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
    unitsSold: z.number(),
    totalRevenue: z.number(),
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
  topSellingProducts: z.array(ProductPerformanceInfoSchema).describe('A list of the best-selling products this month.'),
  worstSellingProducts: z.array(ProductPerformanceInfoSchema).describe('A list of the worst-selling products this month.'),
  unsoldProducts: z.array(ProductPerformanceInfoSchema).describe('A list of products that had zero sales this month.'),
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

**PERINTAH UTAMA:** Buat 2-3 rekomendasi promo penukaran poin yang cerdas dan menguntungkan. PASTIKAN SEMUA REKOMENDASI HANYA DAN HARUS MENGGUNAKAN NAMA PRODUK YANG TERSEDIA DI DATA. JANGAN PERNAH MENGGUNAKAN NAMA GENERIK SEPERTI 'Produk A'.

**Gunakan data kinerja di bawah ini untuk membuat promo yang strategis:**
1.  **Untuk Produk Belum Laku**: Buat promo 'pemancing' untuk memperkenalkan produk ini. Contoh: "Dapatkan diskon 50% untuk **[nama produk belum laku]** dengan menukar poin." Ini akan mendorong pelanggan mencoba item baru.
2.  **Untuk Produk Kurang Laris**: Buat promo 'bundling' dengan produk terlaris. Contoh: "Beli **[nama produk terlaris]**, dapatkan **[nama produk kurang laris]** hanya dengan tambahan X poin." Ini membantu meningkatkan penjualan item yang lambat bergerak.
3.  **Pertimbangkan Keuntungan**: Perhatikan `hargaJual` dan `hargaPokok` untuk menyarankan promo yang tetap masuk akal secara bisnis.

**DATA KINERJA TOKO (BULAN INI):**

- **Promo Aktif Saat Ini:**
{{#if currentRedemptionOptions.length}}
  {{#each currentRedemptionOptions}}
  - {{description}} (membutuhkan {{pointsRequired}} poin, status: {{#if isActive}}Aktif{{else}}Tidak Aktif{{/if}})
  {{/each}}
{{else}}
  - Belum ada promo penukaran poin yang dibuat.
{{/if}}

- **Produk Terlaris (Nama, Jual, Pokok, Unit Terjual, Total Omset):**
{{#if topSellingProducts.length}}
  {{#each topSellingProducts}}
  - {{name}} (Jual: {{price}}, Pokok: {{costPrice}}, Terjual: {{unitsSold}}, Omset: {{totalRevenue}})
  {{/each}}
{{else}}
  - Tidak ada data produk terlaris.
{{/if}}

- **Produk Kurang Laris (Nama, Jual, Pokok, Unit Terjual, Total Omset):**
{{#if worstSellingProducts.length}}
  {{#each worstSellingProducts}}
  - {{name}} (Jual: {{price}}, Pokok: {{costPrice}}, Terjual: {{unitsSold}}, Omset: {{totalRevenue}})
  {{/each}}
{{else}}
  - Tidak ada produk yang berkinerja buruk signifikan bulan ini.
{{/if}}

- **Produk Belum Terjual (Nama, Jual, Pokok):**
{{#if unsoldProducts.length}}
  {{#each unsoldProducts}}
  - {{name}} (Jual: {{price}}, Pokok: {{costPrice}})
  {{/each}}
{{else}}
  - Semua produk terjual setidaknya satu kali bulan ini.
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
