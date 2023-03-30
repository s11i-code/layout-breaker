import { off } from "process";
import { Page, Viewport } from "puppeteer";
import { ContainerList, Rect } from "./types";

export interface Params {
  page: Page;
  containers: ContainerList;
}

export async function generateOverflowScreenshots(params: Params): Promise<number[]> {
  return params.page.evaluate(async (containers) => {
    const vocabulary = getVocabulary();
    const textGenerationChunkSize = 4;
    const indexes: number[] = [];
    // Run promises sequentally to make sure the reset for the previous overflow
    // happens before the next one:

    for (const [index, container] of Object.entries(Array.from(containers))) {
      const filename = `${await getFileNamePrefix()}-${index}`;
      if (await generateOverflow(filename, container, vocabulary, Number(index))) {
        indexes.push(Number(index));
      }
    }

    return indexes;

    // BODY ENDS----------------------------------------------------------------------
    // BEGIN HELPER FUNCTIONS:

    function getVocabulary(): string[] {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return document
        .querySelector("body")!
        .innerText.split(/\s/)
        .filter((w) => w.length || !["-", "–"].includes(w));
    }

    function elementFilter(container: HTMLElement, viewport: Viewport, element: HTMLElement, _index: number): boolean {
      return (
        element.nodeType === Node.ELEMENT_NODE &&
        !!element.innerText &&
        isInViewport(element.getBoundingClientRect(), viewport) &&
        Array.from(element.childNodes).some((child) => child.nodeType === Node.TEXT_NODE) &&
        isVisibleInDOM(element, container)
      );
    }

    function countTextLines(element: HTMLElement, style = window.getComputedStyle(element)): number {
      const elementHeight = element.offsetHeight;
      const lineHeight = parseCSSPixelValue(style.lineHeight);
      const lines = elementHeight / lineHeight;
      return Math.round(lines);
    }

    function generateText(vocabulary: string[], wordCount: number): string {
      const randomWords = Array.from(Array(wordCount)).map(() => getRandomElement(vocabulary));
      return makeSentences(randomWords);
    }

    function stopGenerating(originalDimensions: Rect, currentDimensions: Rect, fontSize: number): boolean {
      const TEXT_GENERATION_MULTIPLIER = 25 / fontSize;
      const areaAboveThreshold =
        currentDimensions.width * currentDimensions.height >
        originalDimensions.width * originalDimensions.height * TEXT_GENERATION_MULTIPLIER;

      return areaAboveThreshold;
    }

    async function generateOverflow(filepath: string, container: HTMLElement, vocabulary: string[], _index: number): Promise<boolean> {
      const { viewport } = await getTaskData();
      const descendants = Array.from(container.querySelectorAll<HTMLElement>("*")).filter((element, index) =>
        elementFilter(container, viewport, element, index)
      );
      // const boundedDescendants = descendants.filter((element) => {
      //   const boundedSides = getBoundedSides(element, descendants).map((bs) => bs.side);
      //   return boundedSides.includes("Right") || boundedSides.includes("Bottom");
      // });

      if (descendants.length === 0) {
        return false;
      }

      const element = getRandomElement(descendants);
      const elementStyle = window.getComputedStyle(element);
      const elementRect = element.getBoundingClientRect();

      const MODIFIED_CSS_PROPERTIES: Readonly<Array<keyof CSSStyleDeclaration>> = [
        "display",
        "whiteSpace",
        "height",
        "width",
        "maxHeight",
        "maxWidth",
        "textOverflow"
      ] as const;

      type ModifiedProperty = typeof MODIFIED_CSS_PROPERTIES[number];
      type ModifiedCSS = Record<ModifiedProperty, string>;

      const oldStyle = getStyle(elementStyle, MODIFIED_CSS_PROPERTIES);
      const newStyle: Partial<ModifiedCSS> = {
        border: "1px solid gainsboro"
      };

      const isOneLiner = countTextLines(element, elementStyle) === 1;

      // prevent one-liners from wrapping:
      if (isOneLiner) {
        Object.assign(newStyle, { whiteSpace: "nowrap", textOverflow: "clip" });
      } else {
        newStyle["whiteSpace"] = "normal";
      }

      Object.assign(element.style, newStyle);

      const closestBlockParent = getClosestAncestor(element, (el) => window.getComputedStyle(el).display === "block");
      if (closestBlockParent) {
        fixDimensions(closestBlockParent);
      }

      if (elementStyle.overflow === "hidden") {
        //create overflow where text row is half-rendered:

        const halfLineHeight = parseInt(elementStyle.lineHeight) * 0.5;
        const height = isOneLiner ? 0 : elementRect.height + halfLineHeight;
        fixDimensions(element, { width: elementRect.width, height: height });
      } else {
        // just allow the text overflow the normal way, hopefully going outside the container or on top of something else
        fixDimensions(element, elementRect);
      }

      // THE GIST IS HERE: increase text to create overflow
      const oldText = element.innerText;

      const originalDimensions = { width: element.scrollWidth, height: element.scrollHeight };
      let currentDimensions = { width: element.scrollWidth, height: element.scrollHeight };
      const history = [];

      debugger;

      if (_index > 20) {
      }

      while (!stopGenerating(originalDimensions, currentDimensions, parseCSSPixelValue(elementStyle.fontSize))) {
        if (history.length > 20) {
          console.log("too many generations", history.length);
          return false;
        }
        const generated = generateText(vocabulary, textGenerationChunkSize);
        element.innerText = `${element.innerText} ${generated}`;
        currentDimensions = { width: element.scrollWidth, height: element.scrollHeight };
        history.push(currentDimensions);
      }

      console.log("attempts for index", _index, ": ", history.length);

      await screenshotRect({
        rect: container.getBoundingClientRect().toJSON(),
        filepath: `${filepath}`
      });

      // reset:
      element.innerText = oldText;
      Object.assign(element.style, oldStyle);
      return true;
    }
  }, params.containers);
}
