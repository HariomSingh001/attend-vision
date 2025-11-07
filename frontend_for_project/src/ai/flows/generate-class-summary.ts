'use server';

/**
 * @fileOverview A class attendance summary AI agent.
 *
 * - generateClassSummary - A function that handles the class attendance summary process.
 * - GenerateClassSummaryInput - The input type for the generateClassSummary function.
 * - GenerateClassSummaryOutput - The return type for the generateClassSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateClassSummaryInputSchema = z.object({
  className: z.string().describe('The name of the class.'),
  attendanceRecords: z
    .string()
    .describe(
      'A stringified JSON array of attendance records, where each record includes the student name and attendance status (present, absent, late).'
    ),
});
export type GenerateClassSummaryInput = z.infer<typeof GenerateClassSummaryInputSchema>;

const GenerateClassSummaryOutputSchema = z.object({
  summary: z.string().describe('A summary of the attendance patterns and trends for the class.'),
  absentStudents: z
    .array(z.string())
    .describe('A list of students who are frequently absent.'),
});
export type GenerateClassSummaryOutput = z.infer<typeof GenerateClassSummaryOutputSchema>;

export async function generateClassSummary(input: GenerateClassSummaryInput): Promise<GenerateClassSummaryOutput> {
  return generateClassSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateClassSummaryPrompt',
  input: {schema: GenerateClassSummaryInputSchema},
  output: {schema: GenerateClassSummaryOutputSchema},
  prompt: `You are a helpful assistant that analyzes class attendance records and generates a summary of attendance patterns and trends.

You will receive the class name and a JSON array of attendance records. Your goal is to identify students who are frequently absent and provide an overall summary of class attendance behavior.

Class Name: {{{className}}}
Attendance Records: {{{attendanceRecords}}}

Based on the attendance records, provide a summary of the attendance patterns and trends for the class, and identify students who are frequently absent.  Include the names of the students in the absentStudents array.

Summary:`,
});

const generateClassSummaryFlow = ai.defineFlow(
  {
    name: 'generateClassSummaryFlow',
    inputSchema: GenerateClassSummaryInputSchema,
    outputSchema: GenerateClassSummaryOutputSchema,
  },
  async input => {
    try {
      // Parse the attendanceRecords string to a JSON array
      const attendanceRecords = JSON.parse(input.attendanceRecords);

      // Check if attendanceRecords is indeed an array
      if (!Array.isArray(attendanceRecords)) {
        throw new Error('attendanceRecords is not a valid JSON array.');
      }

      const {output} = await prompt(input);
      return output!;
    } catch (error: any) {
      console.error('Error parsing attendance records:', error);
      throw new Error(`Failed to parse attendance records: ${error.message}`);
    }
  }
);
