import { readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
// import { cleanMergedFile } from './clean.js';

const universitySchema = z.object({
  characterSummary: z.string(),
  admissionsFocus: z.string(),
  knownFor: z.array(z.string()),
  studentOrgs: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })),
  professors: z.array(z.object({
    name: z.string(),
    bio: z.string(),
  })),
  events: z.array(z.object({
    title: z.string(),
    date: z.string().optional(),
    description: z.string().optional(),
  }))
});

type UniversityData = z.infer<typeof universitySchema>;

function deduplicateBy<T>(arr: T[], keyFn: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of arr) map.set(keyFn(item).toLowerCase(), item);
  return Array.from(map.values());
}

export function mergeUniversityFiles(university: string, runDir: string) {
  const files = readdirSync(runDir).filter(f => f.startsWith(university + '-') && f.endsWith('.json'));

  const merged: UniversityData = {
    characterSummary: '',
    admissionsFocus: '',
    knownFor: [],
    studentOrgs: [],
    professors: [],
    events: []
  };

  for (const file of files) {
    const fullPath = join(runDir, file);
    const raw = readFileSync(fullPath, 'utf-8');
    const parsed = JSON.parse(raw);

    merged.characterSummary += parsed.characterSummary ? parsed.characterSummary + ' ' : '';
    merged.admissionsFocus += parsed.admissionsFocus ? parsed.admissionsFocus + ' ' : '';
    merged.knownFor.push(...(parsed.knownFor || []));
    merged.studentOrgs.push(...(parsed.studentOrgs || []));
    merged.professors.push(...(parsed.professors || []));
    merged.events.push(...(parsed.events || []));
  }

  merged.knownFor = Array.from(new Set(merged.knownFor.map(v => v.toLowerCase())));
  merged.studentOrgs = deduplicateBy(merged.studentOrgs, o => o.name);
  merged.professors = deduplicateBy(merged.professors, p => p.name);
  merged.events = deduplicateBy(merged.events, e => e.title + (e.date || ''));

  const outputPath = join(runDir, `${university}-${runDir.split("/").pop()}.json`);
  writeFileSync(outputPath, JSON.stringify(merged, null, 2));
  console.log(`✅ Merged into ${outputPath}`);

  for (const file of files) unlinkSync(join(runDir, file));
  console.log(`🧹 Deleted ${files.length} temp files.`);

//   cleanMergedFile(outputPath);

  console.log(JSON.stringify(merged, null, 2));
}
