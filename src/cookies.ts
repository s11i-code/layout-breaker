import { Page } from "puppeteer";

export async function attemptCookieConsent(page: Page): Promise<void> {
  //await page.exposeFunction("acceptXcc", acceptXcc);
  //const frame = page.frames()[0];

  //give the prompt a few seconds to start loading:
  //await new Promise((resolve) => setTimeout(resolve, 3000));
  await page.content();
  await page.waitForNetworkIdle();

  await page.evaluate(() => {
    function acceptXcc(doc: Document): void {
      function xccContains(): HTMLElement[] {
        const exactTextRegex = /^(Okay|OK)$/i;
        const partialTextRegex = /(Approve|Accept|Hyväksy)/i;
        const attributeMatchers = ["cookie", "consent", "tc"];
        const selectors = attributeMatchers.map((sel) => `[id*=${sel}] a, [class*=${sel}] a, [id*=${sel}] button, [class*=${sel}] button`);
        const elements = selectors.map((sel) => Array.from(doc.querySelectorAll<HTMLElement>(sel))).flat();
        return elements.filter(function (element) {
          const text = element.textContent && element.textContent.trim();
          return text && (exactTextRegex.test(text) || partialTextRegex.test(text));
        });
      }
      const _xcc = xccContains();
      if (_xcc != null && _xcc.length != 0) {
        _xcc[0].click();
      }
    }

    acceptXcc(document);

    // Array.from(iframes).forEach((iframe) => {
    //   iframe.contentDocument && acceptXcc(iframe.contentDocument);
    // });
  });

  // const frames = await page.frames();
  // await Promise.all(
  //   frames.map(async (frame) => {
  //     const button = await frame.$(".sp_choice_type_11");
  //     button?.click();
  //   })
  // );
}
