import playwright from "playwright";
import * as dotenv from "dotenv";
import { summarizeText } from "./summarize.js";
import { extractUniversityInfo } from "./extract.js";
import { askLLMToPrioritizeLinks } from "./prioritize.js";
import { mergeUniversityFiles } from "./merge.js";
import universities from "./universities.json" assert { type: "json" };

dotenv.config();

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = `data/${runId}`;

async function scrapeUniversitySite(name: string, startUrl: string, runDir: string) {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(startUrl, { waitUntil: "domcontentloaded" });

  // Step 1: Scrape and summarize homepage
  const homepageText = await page.evaluate(() => document.body.innerText);
  console.log(`\n[Homepage] Scraped text length: ${homepageText.length} characters`);
  await summarizeText(homepageText);

  // Step 2: Grab all internal links
  const allLinks = await page.$$eval('a[href]', (anchors: Element[]) =>
    anchors.map(a => ({
      href: (a as HTMLAnchorElement).href,
      text: (a as HTMLAnchorElement).innerText.trim(),
    })).filter(link => {
      try {
        return link.href.includes(new URL(window.location.href).hostname);
      } catch {
        return false;
      }
    })
  );

  console.log(`\nFound ${allLinks.length} internal links.`);

  // Step 3: 🧠 Use LLM to prioritize the best ones
  const prioritizedLinks = await askLLMToPrioritizeLinks(allLinks);
  console.log(`Prioritized ${prioritizedLinks.length} interesting links.`);

  // Step 4: Visit prioritized links
  for (const link of prioritizedLinks) {
    console.log(`\nVisiting: ${link.href}`);
    try {
      await page.goto(link.href, { waitUntil: "domcontentloaded" });
      const pageText = await page.evaluate(() => document.body.innerText);

      console.log(`[Subpage] Scraped text length: ${pageText.length} characters`);
      await extractUniversityInfo(name, pageText, runDir);
    } catch (error) {
      console.error(`Failed to scrape ${link.href}:`, error);
    }
  }

  await browser.close();
  mergeUniversityFiles(name.toLowerCase().replace(/\s+/g, "_"), runDir);
}

// Start here 🚀
(async () => {
  for (const { name, url } of universities) {
    console.log(`\n===============================`);
    console.log(`🎓 Starting scrape for: ${name}`);
    console.log(`===============================\n`);
    try {
      await scrapeUniversitySite(name, url, runDir);
    } catch (err) {
      console.error(`❌ Error scraping ${name}:`, err);
    }
  }
})();
