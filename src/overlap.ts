import { Page } from "puppeteer";
import { ContainerList, Resolution, Side } from "./types";

export interface Params {
  page: Page;
  containers: ContainerList;
}

export async function generateOverlapScreenshots(params: Params): Promise<number[]> {
  return params.page.evaluate(async (containers) => {
    const indexes: number[] = [];

    const elementsSeen = {};
    const filteredContainers = containers.filter((el) => el.childElementCount > 1 && !elementAlreadyAdded(el, elementsSeen));

    // Run promises sequentially to make sure the reset for the previous overflow
    // happens before the next one:
    for (const [index, container] of Object.entries(Array.from(filteredContainers))) {
      if (await generateOverlap(container, Number(index))) {
        indexes.push(Number(index));
      }
    }

    return indexes;

    // BODY ENDS----------------------------------------------------------------------
    // BEGIN HELPER FUNCTIONS:

    async function generateOverlap(container: HTMLElement, idx: number): Promise<boolean> {
      const { viewport } = await getTaskData();

      // first do a quick check for performance
      // before we get to to heavier DOM filtering:
      if (container.childElementCount <= 1) {
        return false;
      }

      const children = (Array.from(container.children) as HTMLElement[]).filter((element) => elementFilter(viewport, element));

      if (children.length <= 1) {
        return false;
      }

      const containerRect = container.getBoundingClientRect().toJSON();

      fixDimensions(container, containerRect);
      // shuffle to introduce variation:
      const shuffledIndices = shuffle(Array.from(children.keys()));
      const [first, ...rest] = shuffledIndices;
      // pick first at from shuffled indices so it's random:
      const element = children[first];
      const style = window.getComputedStyle(element);
      const boundedSides = getBoundedSides(
        element,
        rest.map((index) => children[index])
      );

      if (boundedSides.length === 0) {
        return false;
      }

      const randomBoundedSide = getRandomElement(boundedSides);
      const offsetBase = parseInt(style[`margin${randomBoundedSide}`]) || 5 + parseInt(style[`padding${randomBoundedSide}`]) || 5;

      const offset = getRandomInt(offsetBase / 4, offsetBase / 2);

      Object.assign(element.style, { [`margin${randomBoundedSide}`]: `-${offset}px` });

      await screenshotRect({ rect: containerRect, filepath: `${await getFileNamePrefix()}-${idx}` });

      //reset style:
      Object.assign(element.style, prevStyle);

      return true;
    }

    function elementFilter(viewport: Resolution, child: HTMLElement): boolean {
      return child.nodeType === Node.ELEMENT_NODE && isVisible(child) && isInViewport(child.getBoundingClientRect(), viewport);
    }
  }, params.containers);
}
