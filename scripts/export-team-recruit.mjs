/**
 * team-recruit.html → PNG 出力
 * Usage: node scripts/export-team-recruit.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const htmlPath = path.join(root, "team-recruit.html");
const outDir = path.join(root, "output");

if (!fs.existsSync(htmlPath)) {
  console.error("Missing:", htmlPath);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/");

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(fileUrl, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.teamRecruitExport && window.teamRecruitExport.ready(), {
  timeout: 30000,
});

const count = await page.evaluate(() => window.teamRecruitExport.slideCount());
const written = [];

for (let i = 0; i < count; i++) {
  const { dataUrl, filename } = await page.evaluate((index) => {
    return {
      dataUrl: window.teamRecruitExport.getDataUrl(index),
      filename: window.teamRecruitExport.getFilename(index),
    };
  }, i);

  if (!dataUrl || !dataUrl.startsWith("data:image/png;base64,")) {
    console.error("Failed to export slide", i + 1);
    continue;
  }

  const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const outPath = path.join(outDir, filename);
  fs.writeFileSync(outPath, Buffer.from(b64, "base64"));
  written.push(outPath);
  console.log("Wrote", outPath);
}

await browser.close();

if (!written.length) {
  console.error("No images exported.");
  process.exit(1);
}

console.log("Done:", written.length, "file(s) in", outDir);
