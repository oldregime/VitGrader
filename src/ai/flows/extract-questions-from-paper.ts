'use server';

/**
 * @fileOverview A flow that extracts question details from a question paper document.
 * 
 * - extractQuestionsFromPaper - Extracts and structures questions from a question paper.
 * - ExtractQuestionsFromPaperInput - Input type for the flow.
 * - ExtractQuestionsFromPaperOutput - Output type for the flow.
 * - QuestionDetail - The structure for a single extracted question.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractQuestionsFromPaperInputSchema = z.object({
  questionPaperDataUri: z
    .string()
    .describe(
      "A document containing questions, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
    subject: z.string().optional().describe('The subject or course name to provide context.'),
});
export type ExtractQuestionsFromPaperInput = z.infer<typeof ExtractQuestionsFromPaperInputSchema>;

const QuestionDetailSchema = z.object({
    questionId: z.string().describe("A unique identifier for the question (e.g., Q1a, Q1b, Q2)."),
    questionText: z.string().describe("The full text of the question or sub-question."),
    maxMarks: z.number().describe("The maximum marks for the question. Estimate if not explicitly mentioned."),
    modelAnswer: z.string().describe("A concise, textbook-quality model answer for the question."),
    rubric: z.object({
        keywords: z.array(z.string()).describe("A list of short, specific keywords or phrases expected in the answer."),
    }).describe("The grading rubric for the question."),
});
export type QuestionDetail = z.infer<typeof QuestionDetailSchema>;

const ExtractQuestionsFromPaperOutputSchema = z.object({
    questions: z.array(QuestionDetailSchema).describe("An array of all extracted questions and their details."),
});
export type ExtractQuestionsFromPaperOutput = z.infer<typeof ExtractQuestionsFromPaperOutputSchema>;


export async function extractQuestionsFromPaper(input: ExtractQuestionsFromPaperInput): Promise<ExtractQuestionsFromPaperOutput> {
    return extractQuestionsFromPaperFlow(input);
}


const extractQuestionsPrompt = ai.definePrompt({
    name: 'extractQuestionsPrompt',
    input: { schema: ExtractQuestionsFromPaperInputSchema },
    output: { schema: ExtractQuestionsFromPaperOutputSchema },
    prompt: `You are an AI assistant tasked with analyzing a question paper and structuring its content.
Your goal is to meticulously extract all questions, including their subparts, and generate relevant metadata for each.
Follow these instructions precisely:

1.  **Analyze the Document**: Process the provided document to identify all questions and their subparts in the order they appear.
2.  **Assign IDs**: Create a unique 'Question ID' for each question and subpart (e.g., Q1, Q1a, Q1b, Q2).
3.  **Determine Marks**: For each subquestion, identify the maximum marks. If marks are not explicitly stated, estimate a reasonable value based on the question's complexity and context from other questions.
4.  **Generate Model Answers**: For each subquestion, formulate a concise and accurate model answer based on standard textbook knowledge.
5.  **Generate Rubric**: For each subquestion, create a grading rubric containing:
    - \`keywords\`: A list of short, specific keywords or phrases essential for a complete answer.
6.  **Handle Ambiguity**: If any question details are unclear or incomplete, use the provided subject/course name ('{{subject}}') and context from other questions to fill in the gaps logically and accurately.
7.  **Ignore Non-Question Text**: Disregard any text that is not part of a question, such as faculty names, course codes, time limits, or general instructions.
8.  **Output**: Structure the entire output according to the defined JSON schema.

Document to Analyze:
{{media url=questionPaperDataUri}}
`
});


const extractQuestionsFromPaperFlow = ai.defineFlow(
    {
        name: 'extractQuestionsFromPaperFlow',
        inputSchema: ExtractQuestionsFromPaperInputSchema,
        outputSchema: ExtractQuestionsFromPaperOutputSchema,
    },
    async (input) => {
        const { output } = await extractQuestionsPrompt(input);
        return output!;
    }
);
