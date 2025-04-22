import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";

dotenv.config();

const model = new ChatOpenAI({
  modelName: "gpt-4-turbo",
  temperature: 0,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

export type UniversityData = {
  characterSummary: string;
  admissionsFocus: string;
  knownFor: string[];
  studentOrgs: { name: string; description: string }[];
  professors: { name: string; department: string; bio: string }[];
  events: { title: string; date?: string; description?: string }[];
};

const defaultUniversityData: UniversityData = {
  characterSummary: "",
  admissionsFocus: "",
  knownFor: [],
  studentOrgs: [],
  professors: [],
  events: [],
};

let savedPages = 0;
let skippedPages = 0;

export async function extractUniversityInfo(universityName: string, pageText: string) {
  console.log(`[Extracting info for: ${universityName}]`);

  try {
    const results = await Promise.allSettled([
      askField("Summarize the character of this university in 1-2 sentences.", pageText),
      askField("Summarize the focus of this university's admissions process in 1-2 sentences.", pageText),
      askFieldList("List a few fields this university is especially known for, one per line.", pageText),
      askFieldList("List 3-5 student organizations. Format each as: Name: Description", pageText),
      askFieldList("List 3-5 professors. Format each as: Name (Department): Short Bio", pageText),
      askFieldList("List 3-5 upcoming events. Format each as: Title | Date | Short Description", pageText),
    ]);

    const [
      characterSummaryResult,
      admissionsFocusResult,
      knownForResult,
      studentOrgsResult,
      professorsResult,
      eventsResult,
    ] = results;

    const parsedData: UniversityData = {
      characterSummary: getResult(characterSummaryResult) || "",
      admissionsFocus: getResult(admissionsFocusResult) || "",
      knownFor: getResult(knownForResult) || [],
      studentOrgs: parseNameDescriptionList(getResult(studentOrgsResult) || []),
      professors: parseProfessorList(getResult(professorsResult) || []),
      events: parseEventList(getResult(eventsResult) || []),
    };

    console.log("\n--- Extracted University Info ---");
    console.log(JSON.stringify(parsedData, null, 2));

    const filename = `data/${universityName.toLowerCase().replace(/\s+/g, "_")}.json`;

    if (!existsSync("data")) {
      mkdirSync("data");
    }

    let existingData: UniversityData = defaultUniversityData;
    if (existsSync(filename)) {
      try {
        const rawData = readFileSync(filename, "utf8");
        existingData = JSON.parse(rawData); // ✅ Only parse actual saved JSON file
      } catch (e) {
        console.warn(`⚠️ Warning: Failed to parse existing file: ${filename}, starting fresh.`);
      }
    }

    // Merge fields
    existingData.characterSummary ||= parsedData.characterSummary;
    existingData.admissionsFocus ||= parsedData.admissionsFocus;
    existingData.knownFor = deduplicate([...existingData.knownFor, ...parsedData.knownFor]);
    existingData.studentOrgs = deduplicateByName([...existingData.studentOrgs, ...parsedData.studentOrgs]);
    existingData.professors = deduplicateByName([...existingData.professors, ...parsedData.professors]);
    existingData.events = deduplicateByTitle([...existingData.events, ...parsedData.events]);

    writeFileSync(filename, JSON.stringify(existingData, null, 2));
    console.log(`✅ Saved extracted and merged data to ${filename}`);
    savedPages++;

  } catch (err) {
    console.warn("⚠️ Unexpected error during extraction, skipping page:", err);
    skippedPages++;
  }
}

export function summarizeScrape() {
  console.log(`\n🎯 Scraping complete.`);
  console.log(`✅ Saved pages: ${savedPages}`);
  console.log(`⚠️ Skipped pages: ${skippedPages}`);
}

// --- 🛠️ LLM Helpers ---

async function askField(instruction: string, text: string): Promise<string> {
  const prompt = `
${instruction}

Return only plain text. Do not format as JSON. No preambles, no explanations, no code blocks.

Page Content:
${text}
  `.trim();

  const response = await model.invoke(prompt);
  const output = typeof response.content === "string" ? response.content.trim() : "";

  // ✨ Remove any backticks or markdown garbage
  return output.replace(/```[\s\S]*?```/g, "").trim();
}

async function askFieldList(instruction: string, text: string): Promise<string[]> {
  const raw = await askField(instruction, text);
  return raw
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
}

function getResult(result: PromiseSettledResult<any>): any {
  if (result.status === "fulfilled") {
    return result.value;
  } else {
    console.warn("⚠️ Warning: Some extraction failed:", result.reason);
    return undefined;
  }
}

// --- 🛠️ Parsing Helpers ---

function parseNameDescriptionList(lines: string[]): { name: string; description: string }[] {
  return lines.map(line => {
    const [name, ...descParts] = line.split(":");
    return { name: name?.trim() || "", description: descParts.join(":").trim() || "" };
  }).filter(item => item.name);
}

function parseProfessorList(lines: string[]): { name: string; department: string; bio: string }[] {
  return lines.map(line => {
    const profMatch = line.match(/^(.+?)\s+\((.+?)\):\s*(.+)$/);
    if (!profMatch) return { name: "", department: "", bio: "" };
    return { name: profMatch[1].trim(), department: profMatch[2].trim(), bio: profMatch[3].trim() };
  }).filter(item => item.name);
}

function parseEventList(lines: string[]): { title: string; date: string; description: string }[] {
  return lines.map(line => {
    const [title, date, ...descParts] = line.split("|");
    return { title: title?.trim() || "", date: date?.trim() || "", description: descParts.join("|").trim() || "" };
  }).filter(item => item.title);
}

// --- 🛠️ Deduplication Helpers ---

function deduplicate(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.toLowerCase()))];
}

function deduplicateByName<T extends { name: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    if (!item.name || seen.has(item.name.toLowerCase())) return false;
    seen.add(item.name.toLowerCase());
    return true;
  });
}

function deduplicateByTitle<T extends { title: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    if (!item.title || seen.has(item.title.toLowerCase())) return false;
    seen.add(item.title.toLowerCase());
    return true;
  });
}
