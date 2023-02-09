import { Page, Viewport } from "puppeteer";
import { ContainerList } from "./types";

export interface Params {
  page: Page;
  containers: ContainerList;
}

export async function generateOverflowScreenshots(params: Params): Promise<number[]> {
  return params.page.evaluate(async (containers) => {
    const vocabulary = document.querySelector("body")!.innerText.split(" ");
    const indexes: number[] = [];

    const elementsSeen = {};
    const filteredContainers = containers.filter((el) => el.innerText.length > 0 && !elementAlreadyAdded(el, elementsSeen));

    // Run promises sequentally to make sure the reset for the previous overflow
    // happens before the next one:

    for (const [index, container] of Object.entries(Array.from(filteredContainers))) {
      const filename = `${await getFileNamePrefix()}-${index}`;
      if (await generateOverflow(filename, container, vocabulary, Number(index))) {
        indexes.push(Number(index));
      }
    }

    return indexes;

    // BODY ENDS----------------------------------------------------------------------
    // BEGIN HELPER FUNCTIONS:

    function elementFilter(viewport: Viewport, child: HTMLElement): boolean {
      return (
        child.nodeType === Node.ELEMENT_NODE &&
        isVisible(child) &&
        isInViewport(child.getBoundingClientRect(), viewport) &&
        child.innerText.length > 0
      );
    }

    function generateText(originalText: string, vocabulary: string[]): string {
      const denom = Math.log10(originalText.length) || 10;
      const length = Math.ceil(1 / denom);

      return Array.from(Array(length))
        .map(() => getRandomElement(vocabulary))
        .join(" ");
    }

    async function generateOverflow(filepath: string, container: HTMLElement, vocabulary: string[], index: number): Promise<boolean> {
      const { viewport } = await getTaskData();
      const descendents = getDescendentLeafNodes(container, (element) => elementFilter(viewport, element));

      if (descendents.length === 0) {
        return false;
      }

      const child = getRandomElement(descendents);
      const blockParent = getClosestBlockParent(child);
      fixDimensions(blockParent, blockParent.getBoundingClientRect());

      // const prevStyle = window.getComputedStyle(child);
      // THE GIST IS HERE: increase text to create overflow
      const oldText = child.innerText;
      const generated = generateText(oldText, vocabulary);
      //debugger;
      child.innerText = `${oldText} ${generated}`;

      // child.style["overflow"] = "revert";
      // child.style["textOverflow"] = "visible";

      await screenshotRect({
        rect: container.getBoundingClientRect().toJSON(),
        filepath: `${filepath}`
      });

      child.innerText = oldText; // reset text
      return true;
    }
  }, params.containers);
}
