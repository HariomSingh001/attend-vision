'use server';

/**
 * @fileOverview AI-powered suggestion for student matching based on detected face.
 *
 * - suggestStudentMatch - A function that suggests the most likely student match for a detected face.
 * - SuggestStudentMatchInput - The input type for the suggestStudentMatch function.
 * - SuggestStudentMatchOutput - The return type for the suggestStudentMatch function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestStudentMatchInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a face, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  knownStudentNames: z
    .array(z.string())
    .describe('A list of known student names in the class.'),
});
export type SuggestStudentMatchInput = z.infer<typeof SuggestStudentMatchInputSchema>;

const SuggestStudentMatchOutputSchema = z.object({
  suggestedStudentName: z
    .string()
    .describe('The most likely student name that matches the detected face.'),
  confidence: z
    .number()
    .describe('The confidence level of the suggestion (0-1).'),
});
export type SuggestStudentMatchOutput = z.infer<typeof SuggestStudentMatchOutputSchema>;

export async function suggestStudentMatch(input: SuggestStudentMatchInput): Promise<SuggestStudentMatchOutput> {
  return suggestStudentMatchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestStudentMatchPrompt',
  input: {schema: SuggestStudentMatchInputSchema},
  output: {schema: SuggestStudentMatchOutputSchema},
  prompt: `You are an AI assistant that suggests the most likely student name that matches a detected face from a photo.

You are provided with a photo of a face and a list of known student names in the class. You should analyze the photo and compare the facial features with the known students to determine the best match.

Respond with the suggested student name and a confidence level (0-1) indicating the likelihood of the match.

{{media url=photoDataUri}}
Known Student Names: {{#each knownStudentNames}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

Consider factors such as facial features, skin tone, and any other identifying characteristics to make an accurate suggestion.

Ensure that the suggested student name is from the provided list of known student names. If no match can be determined, return a confidence level of 0.
`,
});

const suggestStudentMatchFlow = ai.defineFlow(
  {
    name: 'suggestStudentMatchFlow',
    inputSchema: SuggestStudentMatchInputSchema,
    outputSchema: SuggestStudentMatchOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
