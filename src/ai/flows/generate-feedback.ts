// src/ai/flows/generate-feedback.ts
'use server';

/**
 * @fileOverview AI-powered feedback generation for student answers.
 *
 * This file defines a Genkit flow that takes a student's answer and a model answer
 * as input, and generates constructive feedback using a Large Language Model.
 *
 * @module ai/flows/generate-feedback
 *
 * @exports generateAiFeedback - The main function to generate feedback.
 * @exports GenerateAiFeedbackInput - The input type for the generateAiFeedback function.
 * @exports GenerateAiFeedbackOutput - The output type for the generateAiFeedback function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

/**
 * Input schema for the generateAiFeedback function.
 */
const GenerateAiFeedbackInputSchema = z.object({
  studentAnswer: z.string().describe('The answer provided by the student.'),
  modelAnswer: z.string().describe('The expected or model answer.'),
  question: z.string().describe('The question that was asked.'),
  rubric: z.string().optional().describe('The rubric for grading the answer.'),
});
export type GenerateAiFeedbackInput = z.infer<typeof GenerateAiFeedbackInputSchema>;

/**
 * Output schema for the generateAiFeedback function.
 */
const GenerateAiFeedbackOutputSchema = z.object({
  feedback: z.string().describe('The AI-generated feedback for the student answer.'),
});
export type GenerateAiFeedbackOutput = z.infer<typeof GenerateAiFeedbackOutputSchema>;

/**
 * Main function to generate AI feedback for a student answer.
 * @param input - The input containing the student's answer and the model answer.
 * @returns A promise that resolves to the generated feedback.
 */
export async function generateAiFeedback(input: GenerateAiFeedbackInput): Promise<GenerateAiFeedbackOutput> {
  return generateAiFeedbackFlow(input);
}

/**
 * Prompt definition for generating AI feedback.
 */
const generateFeedbackPrompt = ai.definePrompt({
  name: 'generateFeedbackPrompt',
  input: {schema: GenerateAiFeedbackInputSchema},
  output: {schema: GenerateAiFeedbackOutputSchema},
  prompt: `You are an AI assistant providing constructive feedback to students. 
Given the question, the student's answer, the model answer, and an optional grading rubric, generate a short, helpful, and encouraging feedback comment.
If a rubric is provided, use it to inform the feedback.

Question: {{{question}}}
Student Answer: {{{studentAnswer}}}
Model Answer: {{{modelAnswer}}}
{{#if rubric}}
Rubric: {{{rubric}}}
{{/if}}

Feedback:`,
});

/**
 * Genkit flow for generating AI feedback.
 */
const generateAiFeedbackFlow = ai.defineFlow(
  {
    name: 'generateAiFeedbackFlow',
    inputSchema: GenerateAiFeedbackInputSchema,
    outputSchema: GenerateAiFeedbackOutputSchema,
  },
  async input => {
    const {output} = await generateFeedbackPrompt(input);
    return output!;
  }
);

    