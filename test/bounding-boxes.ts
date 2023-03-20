import chai from "chai";
import { Browser, ElementHandle, Page } from "puppeteer";
import { Side } from "../src/types";
import { renderPage } from "./utils";

const expect = chai.expect;

describe("Bounding boxes", async () => {
  let page: Page;
  let browser: Browser;

  before(async () => {
    [browser, page] = await renderPage("bounded-elements.html");
  });

  after(async () => {
    await page.close();
    await browser.close();
  });

  async function evaluateBoundedSides(page: Page, elementSelector: string, othersSelector: string): Promise<Side[]> {
    return page.evaluate(
      (element, others) => {
        return getBoundedSides(document.querySelector(element)!, Array.from(document.querySelectorAll(others)));
      },
      elementSelector,
      othersSelector
    );
  }

  describe("getBoundedSides", () => {
    it("does not report itself as bounding side", () => {
      return evaluateBoundedSides(page, ".center", ".center").then((result) => {
        expect(result).to.have.members([]);
      });
    });
    it("does not report non-bounding as boundig", () => {
      return evaluateBoundedSides(page, ".left", ".right").then((result) => {
        expect(result).to.have.members([]);
      });
    });
    it("resolves right correctly", () => {
      return evaluateBoundedSides(page, ".center", ".right").then((result) => {
        expect(result).to.have.members(["Right"]);
      });
    });
    it("resolves right correctly", () => {
      return evaluateBoundedSides(page, ".center", ".right").then((result) => {
        expect(result).to.have.members(["Right"]);
      });
    });
    it("resolves left correctly", () => {
      return evaluateBoundedSides(page, ".center", ".left").then((result) => {
        expect(result).to.have.members(["Left"]);
      });
    });
    it("resolves top correctly", () => {
      return evaluateBoundedSides(page, ".center", ".top").then((result) => {
        expect(result).to.have.members(["Top"]);
      });
    });
    it("resolves bottom correctly", () => {
      return evaluateBoundedSides(page, ".center", ".bottom").then((result) => {
        expect(result).to.have.members(["Bottom"]);
      });
    });
    it("resolves all bounding sides correctly for center", () => {
      return evaluateBoundedSides(page, ".center", ".right, .left, .top, .bottom").then((result) => {
        expect(result).to.have.members(["Right", "Left", "Top", "Bottom"]);
      });
    });
    it("resolves all bounding sides correctly for right", () => {
      return evaluateBoundedSides(page, ".right", ".right, .left, .top, .bottom, .center").then((result) => {
        // center is left from right
        expect(result).to.have.members(["Left"]);
      });
    });
  });
});
