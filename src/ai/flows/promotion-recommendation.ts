
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

**PERINTAH UTAMA: PASTIKAN SEMUA REKOMENDASI HANYA DAN HARUS MENGGUNAKAN NAMA PRODUK YANG TERSEDIA DI DATA. JANGAN PERNAH MENGGUNAKAN NAMA GENERIK SEPERTI 'Produk A' ATAU 'Item X'.**

**Data Analisis Kinerja:**
- **Promo Aktif Saat Ini:**
{{#each currentRedemptionOptions}}
  - {{description}} (membutuhkan {{pointsRequired}} poin, status: {{#if isActive}}Aktif{{else}}Tidak Aktif{{/if}})
{{else}}
  - Belum ada promo penukaran poin yang dibuat.
{{/each}}
- **Produk Terlaris Bulan Ini (Nama, Harga Jual, Harga Pokok):**
{{#each topSellingProducts}}
  - {{name}} (Jual: {{price}}, Pokok: {{costPrice}})
{{else}}
  - Tidak ada data
{{/each}}
- **Produk Kurang Laris Bulan Ini (Nama, Harga Jual, Harga Pokok):**
{{#each worstSellingProducts}}
  - {{name}} (Jual: {{price}}, Pokok: {{costPrice}})
{{else}}
  - Tidak ada data
{{/each}}
- **Produk Belum Terjual Bulan Ini (Nama, Harga Jual, Harga Pokok):**
{{#each unsoldProducts}}
  - {{name}} (Jual: {{price}}, Pokok: {{costPrice}})
{{else}}
  - Semua produk terjual bulan ini.
{{/each}}


**Instruksi Strategis:**
1.  **Gunakan Nama Produk Nyata**: Semua deskripsi promo HARUS menyertakan nama produk spesifik dari daftar di atas.
    - **Contoh Buruk**: "Beli Produk A dan dapatkan Produk B gratis."
    - **Contoh Baik**: "Beli **Chika's Kopi Susu** dan dapatkan **Roti Bakar Cokelat** gratis."
2.  **Analisis Keuntungan**: Hitung keuntungan (harga jual - harga pokok) untuk setiap produk. Gunakan ini untuk merekomendasikan promo yang tidak merugikan.
3.  **Manfaatkan Produk Belum Laku**: Usulkan promo "pemancing" untuk produk yang belum laku sama sekali. Contoh: "Beli produk terlaris, dapatkan diskon 50% untuk **[nama produk belum laku]**".
4.  **Buat Bundling Cerdas**: Gabungkan produk kurang laris dengan produk terlaris. Pastikan Anda menggunakan nama produk yang spesifik dari data. Contoh: "Beli **[nama produk terlaris]** dan **[nama produk kurang laris]** hanya dengan Rp XXX".
5.  **Diskon Berbasis Keuntungan**: Jika menyarankan diskon, pastikan nilai diskon lebih kecil dari keuntungan produk tersebut. Berikan justifikasi mengapa promo itu bagus (misal: "membersihkan stok" atau "memperkenalkan produk baru").
6.  **Format Output**: Setiap rekomendasi harus memiliki 'title' (judul menarik), 'description' (deskripsi jelas untuk pelanggan), 'justification' (alasan strategis), 'pointsRequired' (angka yang masuk akal), dan 'value' (nilai promo dalam Rupiah).
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
