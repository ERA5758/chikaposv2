
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

const promptText = `Anda adalah Chika AI, seorang ahli strategi loyalitas untuk bisnis F&B **{{businessDescription}}** bernama **{{activeStoreName}}**.

Tugas Anda adalah menganalisis data dan menghasilkan 2-3 rekomendasi promo loyalitas yang kreatif dan dapat ditindaklanjuti.

**Data Analisis:**
- **Promo Aktif Saat Ini:**
{{#each currentRedemptionOptions}}
  - {{description}} (membutuhkan {{pointsRequired}} poin, status: {{#if isActive}}Aktif{{else}}Tidak Aktif{{/if}})
{{else}}
  - Belum ada promo penukaran poin yang dibuat.
{{/each}}
- **Produk Terlaris Bulan Ini:** {{#if topSellingProducts}}{{#each topSellingProducts}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}Tidak ada data{{/if}}
- **Produk Kurang Laris Bulan Ini:** {{#if worstSellingProducts}}{{#each worstSellingProducts}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}Tidak ada data{{/if}}

**Instruksi KRITIS:**
1.  **WAJIB GUNAKAN NAMA PRODUK AKTUAL**: Saat membuat rekomendasi 'bundling' atau diskon produk, Anda HARUS menggunakan nama produk yang ada di daftar "Produk Terlaris" atau "Produk Kurang Laris". JANGAN PERNAH mengarang atau menggunakan nama produk yang tidak ada dalam daftar tersebut.
    -   Contoh **BENAR**: Jika "Kopi Susu" adalah produk terlaris dan "Donat Coklat" adalah produk kurang laris, Anda bisa menyarankan: "Bundling Hemat: Dapatkan diskon 50% untuk Donat Coklat setiap pembelian Kopi Susu."
    -   Contoh **SALAH (DILARANG)**: "Bundling Roti Sobek dan Kopi Susu." (jika "Roti Sobek" tidak ada dalam daftar).
2.  **Fokus Rekomendasi**:
    -   Buat promo baru yang menarik dan relevan untuk jenis usaha **{{businessDescription}}** (misal: "Diskon khusus hari Selasa", "Gratis Minuman untuk Poin Tertentu").
    -   Usulkan 'bundling' antara produk dari daftar terlaris dan produk dari daftar kurang laris untuk meningkatkan penjualan produk yang lambat.
    -   Jika ada promo lama yang tidak efektif (misalnya, poin terlalu tinggi atau tidak relevan), sarankan untuk **menonaktifkannya** dan berikan alasannya.
3.  **Spesifik & Relevan**: Semua rekomendasi harus sangat relevan untuk sebuah **{{businessDescription}}**. Hindari menyarankan produk atau promo yang tidak sesuai (misalnya, jangan sarankan promo kopi untuk toko vape).
4.  **Format Output**: Setiap rekomendasi HARUS memiliki:
    -   'title': Judul singkat dan menarik (misal: "Promo Bundling Juara", "Diskon Hari Kerja").
    -   'description': Deskripsi promo yang akan dilihat pelanggan (gunakan nama produk aktual!).
    -   'justification': Alasan singkat mengapa ini ide yang bagus, berdasarkan data yang ada.
    -   'pointsRequired': Jumlah poin yang disarankan. Harus angka yang masuk akal.
    -   'value': Nilai promo dalam Rupiah (jika diskon, gunakan nilai diskon. Jika barang gratis, bisa 0).`;


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
