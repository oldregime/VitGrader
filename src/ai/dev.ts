import { config } from 'dotenv';
config();

import '@/ai/flows/extract-text-from-scans.ts';
import '@/ai/flows/generate-feedback.ts';
import '@/ai/flows/score-similarity.ts';
import '@/ai/flows/extract-questions-from-paper.ts';
