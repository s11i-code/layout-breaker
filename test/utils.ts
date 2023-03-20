import puppeteer, { Browser, Page } from "puppeteer";

export async function renderPage(file: string): Promise<[Browser, Page]> {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100,
    timeout: 0,
    args: ["--start-maximized", "--window-size=1920,1040"]
  });
  const page = await browser.newPage();
  const filePath = `file://${process.cwd()}/test/data/${file}`;
  await page
    .goto(filePath, { waitUntil: "load", timeout: 0 })
    .catch((error) => console.error(`Cannot access the site : ${JSON.stringify(error)}. Is there a working Internet connection?`));

  await page.content();

  await page.addScriptTag({ path: `${process.cwd()}/build/src/browser-context/index.js` });

  return [browser, page];
}
