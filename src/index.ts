/* eslint-disable @typescript-eslint/ban-ts-ignore */
import { Browser, PuppeteerLaunchOptions } from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import { ContainerList, Resolution, TaskData } from "./types";
import { ensureFolderExists, getFileName, screenshotElements, screenshotRect, ScreenshotRectParams } from "./utils";
import { attemptCookieConsent } from "./cookies";
import { getContainers } from "./getContainers";
import { Page } from "puppeteer";
import DEFAULT_SITES from "./sites";
import { generateOverlapScreenshots } from "./overlap";
import { generateOverflowScreenshots } from "./overflow";
import { UNTOUCHED, OVERFLOW, OVERLAP, ALL_MANIPULATIONS } from "./consts";
import { parseArgs } from "./args";
import { createCluster } from "./createCluster";

import puppeteer from "puppeteer-extra";

import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(AdblockerPlugin()).use(StealthPlugin());

// ways of sharing:
// - addScriptTag
// - exposeFunction
// - pass as parameter to page evaluate (only elementhandles)

const HASH = (Math.random() + 1).toString(36).substring(8);
const EXECUTION_ID = `${new Date().getMonth()}-${new Date().getDate()}-${HASH}`;

// TODO
const VIEWPORTS: Resolution[] = [
  //{ width: 768, height: 2000 },
  //{ width: 375, height: 2000 },
  { width: 1300, height: 4000 }
];
const DEFAULT_BASE_FOLDER = "layout-breaker-images";

const args = parseArgs();
const {
  debug,
  containerIndexes,
  sites = DEFAULT_SITES,
  manipulations = ALL_MANIPULATIONS,
  folder: baseFolder = DEFAULT_BASE_FOLDER
} = args;

console.log(`Starting scraping execution ${EXECUTION_ID} DEBUG_MODE ${debug}, with args: ${JSON.stringify(args)}`);

const puppeteerOptions: PuppeteerLaunchOptions = {
  headless: !debug,
  devtools: debug,
  timeout: 30000
  //args: ["--disable-web-security", "--disable-features=IsolateOrigins,site-per-process"]
  //args: ["--shm-size=3gb"]
  // executablePath: "load/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
};

const RUN_PARALLEL = debug ? false : true;

(async (): Promise<void> => {
  const cluster = RUN_PARALLEL ? await createCluster(scrapeSite, debug, puppeteerOptions, exit) : undefined;
  const browser = await puppeteer.launch(puppeteerOptions);

  await Promise.all(
    sites.map((site) => {
      return Promise.all(
        VIEWPORTS.map(async (viewport) => {
          return Promise.all(
            manipulations.map(async (manipulation) => {
              const taskData: TaskData = {
                site,
                viewport,
                baseFolder,
                manipulation,
                containerIndexes
              };

              if (cluster) {
                cluster.queue(taskData);
              } else {
                const page = await browser.newPage();
                await scrapeSite({ page, data: taskData }).catch((err) => {
                  console.error("Encountered error", err.stack);
                  exit(browser);
                });
              }
            })
          );
        })
      );
    })
  );

  if (cluster) {
    await cluster.idle();
    exit(cluster);
  } else {
    exit(browser);
  }
})();

async function scrapeSite({ page, data }: { page: Page; data: TaskData }): Promise<void> {
  page.on("console", (consoleObj) => {
    console.log(consoleObj.text());
  });

  page.on("error", (err) => {
    console.log("Error occurred: ", err);
  });

  page.on("pageerror", (pageerr) => {
    console.log("Page error occurred: ", pageerr);
  });

  const { site, viewport, manipulation, baseFolder } = data;

  await page.setBypassCSP(true);

  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });

  await page
    .goto(site, { waitUntil: "load", timeout: 0 })
    .catch((error) => console.error(`Cannot access the site ${site}: ${JSON.stringify(error)}. Is there a working Internet connection?`));

  await page.content();

  await attemptCookieConsent(page);

  // DEFINE FOLDERS
  const folderName = `${baseFolder}/${manipulation}`;
  const entirePagesFolder = `${baseFolder}/entire-pages`;
  const filename = getFileName({ viewport, url: site, prefix: EXECUTION_ID, postfix: manipulation });

  await ensureFolderExists(folderName);
  await ensureFolderExists(entirePagesFolder);

  await page.exposeFunction("screenshotRect", (params: ScreenshotRectParams) => screenshotRect(page, params));
  await page.exposeFunction("getFileNamePrefix", () => `${folderName}/${filename}`);
  await page.exposeFunction("getTaskData", () => data);

  await page.content();
  await page.waitForNetworkIdle();

  await page.addScriptTag({ path: "./build/src/browser-context/index.js" });

  // GET ELEMENTS THAT WILL BE MANIPULATED:
  const containers: ContainerList = await getContainers(page);

  const filepath = `${folderName}/${getFileName({ viewport, url: site, postfix: EXECUTION_ID })}`;

  const containerCount = await page.evaluate((containers) => Array.from(containers).length, containers);

  let indexes: number[];

  if (manipulation === OVERFLOW) {
    indexes = await generateOverflowScreenshots({ page, containers });
  } else if (manipulation === OVERLAP) {
    indexes = await generateOverlapScreenshots({ containers, page });
  } else if (manipulation === UNTOUCHED) {
    const count = await screenshotElements({ page, elements: containers, filepath });
    indexes = [...Array(count).keys()];
  } else {
    throw "Unknown manipulation";
  }

  console.log(
    `Number of ${manipulation.toUpperCase()} rects is ${indexes.length} (out of ${containerCount} containers) for site ${site} in ${
      viewport.width
    }x${viewport.height}.`
  );

  await page.screenshot({
    path: `${entirePagesFolder}/${filename}.png`
  });

  const containersWithGeneratedBug = await page.evaluateHandle(
    (elements, indexes) => Array.from(elements).filter((_elem, index) => indexes.includes(index)),
    containers,
    indexes
  );
  /// add red border to containers for debugging:
  await page.evaluate(function (containers) {
    containers.map((el: HTMLElement) => Object.assign(el.style, { border: "1px solid orange" }));
  }, containersWithGeneratedBug);

  await page.screenshot({
    path: `${entirePagesFolder}/${getFileName({ viewport, url: site, prefix: EXECUTION_ID, postfix: manipulation })}.png`
  });

  /// add red border to containers for debugging:
  await page.evaluate(function (containers) {
    containers.map((el: HTMLElement) => Object.assign(el.style, { border: "1px solid red" }));
  }, containers);

  await page.screenshot({
    path: `${entirePagesFolder}/${getFileName({ viewport, url: site, prefix: EXECUTION_ID, postfix: "containers" })}.png`
  });
}

async function exit(closable: Browser | Cluster): Promise<void> {
  console.log("\n-----------------END RUN", EXECUTION_ID, "-----------------------------------\n");
  closable.close();
  process.exit();
}

declare global {
  /*~ Here, declare things that go in the global namespace, or augment
   *~ existing declarations in the global namespace
   */

  function getFileNamePrefix(): Promise<string>;

  function getTaskData(): Promise<TaskData>;

  //function randomWords(...params: Parameters<typeof randomWordsGenerator>): Promise<ReturnType<typeof randomWordsGenerator>>;
}
