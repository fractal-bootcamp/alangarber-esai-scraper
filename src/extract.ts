// Updated extract.ts to fully reset file content and log extracted values to console
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

export const universitySchema = z.object({
  characterSummary: z.string(),
  admissionsFocus: z.string(),
  knownFor: z.array(z.string()),
  studentOrgs: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })),
  professors: z.array(z.object({
    name: z.string(),
    department: z.string(),
    bio: z.string(),
  })),
  events: z.array(z.object({
    title: z.string(),
    date: z.string().optional(),
    description: z.string().optional(),
  }))
});

export type UniversityData = z.infer<typeof universitySchema>;

let savedPages = 0;
let skippedPages = 0;

export async function extractUniversityInfo(universityName: string, pageText: string) {
  console.log(`[Extracting info for: ${universityName}]`);

  try {
    const { object: parsedData } = await generateObject({
      model: openai('gpt-4.5-preview'),
      schema: universitySchema,
      prompt: `You are an expert assistant extracting structured data from university websites. Use the following page content to generate detailed information for ${universityName} in the specified schema. Only include real entries found in the text.

Page Content:
${pageText}`
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeName = universityName.toLowerCase().replace(/\s+/g, "_");
    const filename = `data/${safeName}-${timestamp}.json`;

    if (!existsSync("data")) {
      mkdirSync("data");
    }

    console.log("\n--- Extracted University Info ---");
    console.log(JSON.stringify(parsedData, null, 2));

    writeFileSync(filename, JSON.stringify(parsedData, null, 2));
    console.log(`✅ Saved structured data to ${filename}`);
    savedPages++;
  } catch (err) {
    console.warn("⚠️ Error generating structured data, skipping page:", err);
    skippedPages++;
  }
}

export function summarizeScrape() {
  console.log(`\n🎯 Scraping complete.`);
  console.log(`✅ Saved pages: ${savedPages}`);
  console.log(`⚠️ Skipped pages: ${skippedPages}`);
}
