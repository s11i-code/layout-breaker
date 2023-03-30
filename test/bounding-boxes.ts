import chai from "chai";
import { Browser, Page } from "puppeteer";
import { Side } from "../src/types";
import { renderPage } from "./utils";

const expect = chai.expect;

describe("Bounding boxes", async () => {
  let page: Page;
  let browser: Browser;

  // note: using the same page for all the tests. It works because the page is not manipulated at any point.
  // if this is changed, move the before/after callbacks to beforeEach/aafterEach.
  before(async () => {
    [browser, page] = await renderPage("bounded-elements.html");
  });

  after(async () => {
    await page.close();
    await browser.close();
  });

  async function evaluateBoundedSides(
    page: Page,
    elementSelector: string,
    othersSelector: string
  ): Promise<Array<{ side: Side; withClass: string | null }>> {
    return page.evaluate(
      (element, others) => {
        const boundedSides = getBoundedSides(document.querySelector(element)!, Array.from(document.querySelectorAll(others)));
        return boundedSides.map((bs) => ({ side: bs.side, withClass: bs.otherElement.getAttribute("class") }));
      },
      elementSelector,
      othersSelector
    );
  }

  const allClasses = ".center, .left, .right, .top, .bottom";
  describe("getBoundedSides", () => {
    it("does not report itself as bounding side", () => {
      return evaluateBoundedSides(page, ".center", ".center").then((result) => {
        expect(result).to.have.members([]);
      });
    });
    it("does not report non-bounding as bounding", () => {
      return evaluateBoundedSides(page, ".left", ".right").then((result) => {
        expect(result).to.have.members([]);
      });
    });
    it("resolves right correctly", () => {
      return evaluateBoundedSides(page, ".center", allClasses).then((result) => {
        expect(result).to.deep.include({ side: "Right", withClass: "right" });
      });
    });
    it("resolves left correctly", () => {
      return evaluateBoundedSides(page, ".center", allClasses).then((result) => {
        expect(result).to.deep.include({ side: "Left", withClass: "left" });
      });
    });
    it("resolves top correctly", () => {
      return evaluateBoundedSides(page, ".center", allClasses).then((result) => {
        expect(result).to.deep.include({ side: "Top", withClass: "top" });
      });
    });
    it("resolves bottom correctly", () => {
      return evaluateBoundedSides(page, ".center", allClasses).then((result) => {
        expect(result).to.deep.include({ side: "Bottom", withClass: "bottom" });
      });
    });
    it("resolves all bounding sides correctly for right", () => {
      return evaluateBoundedSides(page, ".right", allClasses).then((result) => {
        // center is left from right
        expect(result).to.have.deep.members([{ side: "Left", withClass: "center" }]);
      });
    });

    it("resolves all bounding sides correctly for left", () => {
      return evaluateBoundedSides(page, ".left", allClasses).then((result) => {
        // center is left from right
        expect(result).to.have.deep.members([{ side: "Right", withClass: "center" }]);
      });
    });

    it("resolves all bounding sides correctly for top", () => {
      return evaluateBoundedSides(page, ".top", allClasses).then((result) => {
        // center is left from right
        expect(result).to.have.deep.members([{ side: "Bottom", withClass: "center" }]);
      });
    });

    it("resolves all bounding sides correctly for bottom", () => {
      return evaluateBoundedSides(page, ".bottom", allClasses).then((result) => {
        // center is left from right
        expect(result).to.have.deep.members([{ side: "Top", withClass: "center" }]);
      });
    });
  });
});
