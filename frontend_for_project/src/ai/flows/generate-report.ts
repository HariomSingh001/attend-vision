'use server';

/**
 * @fileOverview A class attendance report AI agent.
 *
 * - generateReport - A function that handles the class attendance report generation process.
 * - GenerateReportInput - The input type for the generateReport function.
 * - GenerateReportOutput - The return type for the generateReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateReportInputSchema = z.object({
  className: z.string().describe('The name of the class.'),
  attendanceRecords: z
    .string()
    .describe(
      'A stringified JSON array of attendance records, where each record includes the student name and attendance status (present, absent, late).'
    ),
});
export type GenerateReportInput = z.infer<typeof GenerateReportInputSchema>;

const GenerateReportOutputSchema = z.object({
  report: z.string().describe('A detailed report of the attendance patterns and trends for the class.'),
});
export type GenerateReportOutput = z.infer<typeof GenerateReportOutputSchema>;

export async function generateReport(input: GenerateReportInput): Promise<GenerateReportOutput> {
  return generateReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateReportPrompt',
  input: {schema: GenerateReportInputSchema},
  output: {schema: GenerateReportOutputSchema},
  prompt: `You are a helpful assistant that analyzes class attendance records and generates a detailed report of attendance patterns and trends.

You will receive the class name and a JSON array of attendance records. Your goal is to provide a comprehensive report on class attendance behavior.

Class Name: {{{className}}}
Attendance Records: {{{attendanceRecords}}}

Based on the attendance records, provide a detailed report of the attendance patterns and trends for the class.

Report:`,
});

const generateReportFlow = ai.defineFlow(
  {
    name: 'generateReportFlow',
    inputSchema: GenerateReportInputSchema,
    outputSchema: GenerateReportOutputSchema,
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
