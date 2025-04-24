import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import * as dotenv from 'dotenv';
dotenv.config();

const summarySchema = z.object({
  summary: z.string(),
});

export async function summarizeText(pageText: string) {
  const { object } = await generateObject({
    model: openai('gpt-4.5-preview'),
    schema: summarySchema,
    prompt: `
Summarize the following university webpage clearly and concisely. Return only a single string labeled 'summary'.

Page Content:
${pageText}
`.trim(),
  });

  console.log("\n--- Summary ---");
  console.log(object.summary);
}

// Only run if executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  summarizeText("Stanford University is a private research university in Stanford, California. It is known for its academic strengths in computer science and entrepreneurship...");
}