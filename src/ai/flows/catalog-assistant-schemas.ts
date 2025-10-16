import { z } from 'genkit';

export const ProductInfoSchema = z.object({
  name: z.string(),
  category: z.string(),
  description: z.string().optional(),
  price: z.number(),
  stock: z.number(),
});

export const CatalogAssistantInputSchema = z.object({
  userQuestion: z.string(),
  productContext: z.array(ProductInfoSchema),
  storeName: z.string(),
});

export const CatalogAssistantOutputSchema = z.object({
  answer: z.string(),
});
