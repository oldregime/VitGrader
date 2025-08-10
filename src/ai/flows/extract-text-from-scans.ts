'use server';
/**
 * @fileOverview A flow that extracts text from scanned answer sheets using OCR.
 *
 * - extractTextFromScans - A function that handles the text extraction process.
 * - ExtractTextFromScansInput - The input type for the extractTextFromScans function.
 * - ExtractTextFromScansOutput - The return type for the extractTextFromScans function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractTextFromScansInputSchema = z.object({
  scanDataUri: z
    .string()
    .describe(
      'A scanned image of an answer sheet, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' // KEEP AS SINGLE LINE
    ),
});
export type ExtractTextFromScansInput = z.infer<typeof ExtractTextFromScansInputSchema>;

const ExtractTextFromScansOutputSchema = z.object({
  extractedText: z.string().describe('The extracted text from the scanned image.'),
});
export type ExtractTextFromScansOutput = z.infer<typeof ExtractTextFromScansOutputSchema>;

export async function extractTextFromScans(input: ExtractTextFromScansInput): Promise<ExtractTextFromScansOutput> {
  return extractTextFromScansFlow(input);
}

const extractTextPrompt = ai.definePrompt({
  name: 'extractTextPrompt',
  input: {schema: ExtractTextFromScansInputSchema},
  output: {schema: ExtractTextFromScansOutputSchema},
  prompt: `Extract the text from the following document:

{{media url=scanDataUri}}`,
});

const extractTextFromScansFlow = ai.defineFlow(
  {
    name: 'extractTextFromScansFlow',
    inputSchema: ExtractTextFromScansInputSchema,
    outputSchema: ExtractTextFromScansOutputSchema,
  },
  async input => {
    const {output} = await extractTextPrompt(input);
    return output!;
  }
);
