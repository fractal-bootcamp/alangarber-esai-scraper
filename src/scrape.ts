import playwright from "playwright";
import * as dotenv from "dotenv";
import { summarizeText } from "./summarize.js";
import { extractUniversityInfo } from "./extract.js";
dotenv.config();

async function scrapeUniversitySite(startUrl: string) {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(startUrl, { waitUntil: "domcontentloaded" });

  // Step 1: Scrape and summarize homepage
  const homepageText = await page.evaluate(() => document.body.innerText);
  console.log(`\n[Homepage] Scraped text length: ${homepageText.length} characters`);
  await summarizeText(homepageText);

  // Step 2: Grab all internal links
  const allLinks = await page.$$eval('a[href]', (anchors: Element[]) =>
    anchors
      .map(a => (a as HTMLAnchorElement).href)
      .filter(href => href.includes(new URL(window.location.href).hostname))
  );

  console.log(`\nFound ${allLinks.length} internal links.`);

  // Step 3: Prioritize important links
  const keywords = ["admission", "academics", "student-life", "events", "clubs", "faculty", "departments", "majors", "organizations"];
  const prioritizedLinks = allLinks.filter(link =>
    keywords.some(keyword => link.toLowerCase().includes(keyword))
  );

  console.log(`Prioritized ${prioritizedLinks.length} interesting links.`);

  // Step 4: Visit 3–5 of the prioritized links
  for (const link of prioritizedLinks.slice(0, 5)) {
    console.log(`\nVisiting: ${link}`);
    try {
      await page.goto(link, { waitUntil: "domcontentloaded" });
      const pageText = await page.evaluate(() => document.body.innerText);

      console.log(`[Subpage] Scraped text length: ${pageText.length} characters`);
      await extractUniversityInfo("Stanford University", pageText);
    } catch (error) {
      console.error(`Failed to scrape ${link}:`, error);
    }
  }

  await browser.close();
}

// Start here 🚀
scrapeUniversitySite('https://www.stanford.edu');
