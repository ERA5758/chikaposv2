
/**
 * @fileOverview An AI agent for generating loyalty promotion recommendations.
 *
 * - getPromotionRecommendations - A function that suggests new or updated loyalty promotions.
 * - PromotionRecommendationInput - The input type for thePromotionRecommendationInput function.
 * - PromotionRecommendationOutput - The return type for the getPromotionRecommendations function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const PromotionRecommendationInputSchema = z.object({
  businessDescription: z.string().describe('A brief description of the business (e.g., "kafe", "vape store").'),
  activeStoreName: z.string().describe('The name of the store for context.'),
  allProductNames: z.array(z.string()).describe('A list of all available product names in the menu.'),
  currentRedemptionOptions: z.array(
    z.object({
      description: z.string(),
      pointsRequired: z.number(),
      isActive: z.boolean(),
    })
  ).describe('A list of the current loyalty redemption options.'),
  topSellingProducts: z.array(z.string()).describe('A list of the best-selling products this month.'),
  worstSellingProducts: z.array(z.string()).describe('A list of the worst-selling products this month.'),
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

const promptText = `Anda adalah Chika AI, seorang ahli strategi loyalitas untuk sebuah **{{businessDescription}}** bernama **{{activeStoreName}}**.

**Tugas Anda:** Buat 2-3 rekomendasi promo penukaran poin baru berdasarkan data kinerja yang diberikan.

**Data Analisis Kinerja:**
- **Promo Aktif Saat Ini:**
{{#each currentRedemptionOptions}}
  - {{description}} (membutuhkan {{pointsRequired}} poin, status: {{#if isActive}}Aktif{{else}}Tidak Aktif{{/if}})
{{else}}
  - Belum ada promo penukaran poin yang dibuat.
{{/each}}
- **Produk Terlaris Bulan Ini:** {{#if topSellingProducts}}{{#each topSellingProducts}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}Tidak ada data{{/if}}
- **Produk Kurang Laris Bulan Ini:** {{#if worstSellingProducts}}{{#each worstSellingProducts}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}Tidak ada data{{/if}}
- **Semua Nama Produk di Menu:** {{#each allProductNames}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

**Instruksi:**
1.  **Gunakan Data**: Rekomendasi Anda harus terinspirasi dari data di atas.
2.  **Promo Bundling Cerdas**: Jika Anda menyarankan promo bundling, gunakan produk dari daftar "Produk Terlaris" dan "Produk Kurang Laris" untuk menciptakan penawaran yang menarik. Pastikan Anda menggunakan nama produk yang sebenarnya dari daftar tersebut.
3.  **Promo Kreatif Lainnya**: Selain bundling, usulkan juga promo umum yang relevan untuk **{{businessDescription}}**, seperti diskon pada hari tertentu atau penawaran untuk mendapatkan produk gratis.
4.  **Format Output**: Setiap rekomendasi harus memiliki 'title', 'description' (yang jelas untuk pelanggan), 'justification' (alasan di balik ide tersebut), 'pointsRequired' (angka yang masuk akal), dan 'value' (nilai promo dalam Rupiah).
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
      throw new Error('AI did not return a valid recommendation.');
    }
    return output;
  }
);
