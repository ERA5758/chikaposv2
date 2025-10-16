
/**
 * @fileOverview An AI agent for generating birthday follow-up messages.
 *
 * - getBirthdayFollowUp - A function that generates a birthday message with a discount.
 * - BirthdayFollowUpInput - The input type for the getBirthdayFollowUp function.
 * - BirthdayFollowUpOutput - The return type for the getBirthdayFollowUp function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const BirthdayFollowUpInputSchema = z.object({
  customerName: z.string().describe('The name of the customer.'),
  discountPercentage: z
    .number()
    .describe('The discount percentage to offer.'),
  birthDate: z.string().describe("The customer's birth date in YYYY-MM-DD format."),
});
export type BirthdayFollowUpInput = z.infer<
  typeof BirthdayFollowUpInputSchema
>;

export const BirthdayFollowUpOutputSchema = z.object({
  followUpMessage: z
    .string()
    .describe(
      'A friendly and concise birthday follow-up message for the customer in Indonesian.'
    ),
});
export type BirthdayFollowUpOutput = z.infer<
  typeof BirthdayFollowUpOutputSchema
>;

export async function getBirthdayFollowUp(
  input: BirthdayFollowUpInput
): Promise<BirthdayFollowUpOutput> {
  return birthdayFollowUpFlow(input);
}

const prompt = ai.definePrompt({
  name: 'birthdayFollowUpPrompt',
  input: {schema: BirthdayFollowUpInputSchema},
  output: {schema: BirthdayFollowUpOutputSchema},
  prompt: `You are Chika AI, a friendly assistant for {{activeStoreName}}.

Your task is to generate a birthday follow-up message for a customer. The message should be friendly, concise, and in Indonesian. It must wish them a happy birthday and offer a special discount.

First, determine the customer's zodiac sign from their birth date: {{birthDate}}.
Then, include a short, positive fun fact about that zodiac sign in your message.

Crucially, you must also include the following two conditions in the message:
1.  The customer must show the broadcast message to the cashier to claim the discount.
2.  The discount is valid until the end of their birth month.

Customer Name: {{customerName}}
Discount Percentage: {{discountPercentage}}%

Generate a follow-up message.`,
});

export const birthdayFollowUpFlow = ai.defineFlow(
  {
    name: 'birthdayFollowUpFlow',
    inputSchema: BirthdayFollowUpInputSchema,
    outputSchema: BirthdayFollowUpOutputSchema,
  },
  async input => {
    const { output } = await prompt(input, { model: 'openai/gpt-4o' });

    if (!output) {
      throw new Error('AI did not return a valid message.');
    }
    return output;
  }
);
