
/**
 * @fileOverview A loyalty point recommendation AI agent.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const LoyaltyPointRecommendationInputSchema = z.object({
  loyaltyPoints: z.number().describe('The number of loyalty points the customer has.'),
  totalPurchaseAmount: z.number().describe('The total purchase amount of the current transaction.'),
  availableRedemptionOptions: z.array(
    z.object({
      description: z.string().describe('A description of the redemption option.'),
      pointsRequired: z.number().describe('The number of points required for this option.'),
      value: z.number().describe('The value of this redemption option.'),
    })
  ).describe('The available redemption options for the customer.'),
});
export type LoyaltyPointRecommendationInput = z.infer<typeof LoyaltyPointRecommendationInputSchema>;

export const LoyaltyPointRecommendationOutputSchema = z.object({
  recommendation: z.string().describe('A recommendation for the optimal way for the customer to redeem their loyalty points.'),
});
export type LoyaltyPointRecommendationOutput = z.infer<typeof LoyaltyPointRecommendationOutputSchema>;


const PROMPT_TEMPLATE = `You are an expert in loyalty programs and customer engagement. A customer has {{loyaltyPoints}} loyalty points and is making a purchase of Rp {{totalPurchaseAmount}}. Here are the available redemption options:

{{#each availableRedemptionOptions}}
- {{description}} ({{pointsRequired}} points, Value: Rp {{value}})
{{/each}}

Based on this information, recommend the optimal way for the customer to redeem their points to maximize their benefit and encourage redemption. The recommendation should be a single sentence in Indonesian.

Recommendation: `;

export const loyaltyPointRecommendationFlow = ai.defineFlow(
  {
    name: 'loyaltyPointRecommendationFlow',
    inputSchema: LoyaltyPointRecommendationInputSchema,
    outputSchema: LoyaltyPointRecommendationOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      model: 'openai/gpt-4o',
      prompt: PROMPT_TEMPLATE,
      input: input,
      output: {
        schema: LoyaltyPointRecommendationOutputSchema,
      },
    });
    
    if (!output) {
      throw new Error('AI did not return a valid recommendation.');
    }
    return output;
  }
);

export async function getLoyaltyPointRecommendation(
  input: LoyaltyPointRecommendationInput
): Promise<LoyaltyPointRecommendationOutput> {
  return loyaltyPointRecommendationFlow(input);
}
