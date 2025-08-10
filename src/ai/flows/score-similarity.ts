// This file uses server-side code.
'use server';

/**
 * @fileOverview Computes the semantic similarity between a student's answer and a model answer.
 *
 * - scoreSimilarity - A function that calculates the semantic similarity between two texts.
 * - ScoreSimilarityInput - The input type for the scoreSimilarity function.
 * - ScoreSimilarityOutput - The return type for the scoreSimilarity function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScoreSimilarityInputSchema = z.object({
  studentAnswer: z
    .string()
    .describe('The answer provided by the student.'),
  modelAnswer: z
    .string()
    .describe('The expected answer or key points for the question.'),
});
export type ScoreSimilarityInput = z.infer<typeof ScoreSimilarityInputSchema>;

const ScoreSimilarityOutputSchema = z.object({
  similarityScore: z
    .number()
    .describe(
      'A score between 0 and 1 indicating the semantic similarity between the student and model answers. Higher values indicate greater similarity.'
    ),
  justification: z
    .string()
    .describe(
      'A brief explanation of why the student answer was scored as it was, including key similarities or differences with the model answer.'
    ),
});
export type ScoreSimilarityOutput = z.infer<typeof ScoreSimilarityOutputSchema>;

export async function scoreSimilarity(input: ScoreSimilarityInput): Promise<ScoreSimilarityOutput> {
  return scoreSimilarityFlow(input);
}

const scoreSimilarityPrompt = ai.definePrompt({
  name: 'scoreSimilarityPrompt',
  input: {schema: ScoreSimilarityInputSchema},
  output: {schema: ScoreSimilarityOutputSchema},
  prompt: `You are an AI assistant that evaluates the semantic similarity between a student's answer and a model answer.

Given the student's answer and the model answer, compute a similarity score between 0 and 1, where 1 indicates a perfect match.
Also, provide a justification for the score, highlighting the key similarities or differences between the two answers.

Student's Answer: {{{studentAnswer}}}
Model Answer: {{{modelAnswer}}}

Ensure that your response follows the output schema exactly, especially the similarityScore being a number between 0 and 1.`,
});

const scoreSimilarityFlow = ai.defineFlow(
  {
    name: 'scoreSimilarityFlow',
    inputSchema: ScoreSimilarityInputSchema,
    outputSchema: ScoreSimilarityOutputSchema,
  },
  async input => {
    const {output} = await scoreSimilarityPrompt(input);
    return output!;
  }
);
