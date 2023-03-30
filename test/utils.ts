import puppeteer, { Browser, Page } from "puppeteer";

export async function renderPage(file: string): Promise<[Browser, Page]> {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100,
    timeout: 0,
    args: ["--start-maximized", "--window-size=1920,1040"]
  });
  const page = await browser.newPage();
  page.on("console", (consoleObj) => {
    console.log(consoleObj.text());
  });

  const filePath = `file://${process.cwd()}/test/data/${file}`;
  await page
    .goto(filePath, { waitUntil: "load", timeout: 0 })
    .catch((error) => console.error(`Cannot access the site : ${JSON.stringify(error)}. Is there a working Internet connection?`));

  await page.content();
  await page.exposeFunction("assertExists", assertExists);

  await page.addScriptTag({ path: `${process.cwd()}/build/src/browser-context/index.js` });

  return [browser, page];
}

function exists<T>(arg: T): arg is Exclude<T, null | undefined | typeof NaN> {
  if (arg === null || arg === undefined || Number.isNaN(arg)) {
    return false;
  }
  return true;
}

async function assertExists<T>(value: T): Promise<T> {
  if (exists(value)) {
    return value;
  }
  throw new Error(`Value doesn't exist: ${value}`);
}

// todo: find a better place for this:
declare global {
  function assertExists<T>(value: T): T;
}
