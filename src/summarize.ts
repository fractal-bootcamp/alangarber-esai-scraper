import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
dotenv.config();

const model = new ChatOpenAI({
  modelName: "gpt-4-turbo",
  temperature: 0,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

export async function summarizeText(text: string) {
  const prompt = `Summarize what this webpage is about:\n\n${text}\n\nSummary:`;
  const summary = await model.invoke(prompt);
  console.log("\n--- Summary ---");
  console.log(summary.content); // <-- Only print the summary text
}

// Only run if file is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  summarizeText("Stanford University is a private research university in Stanford, California. It is known for its academic strengths in computer science and entrepreneurship...");
}
