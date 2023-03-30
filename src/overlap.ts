import { Page } from "puppeteer";
import { ContainerList, Resolution, Side } from "./types";

export interface Params {
  page: Page;
  containers: ContainerList;
}

type BoundedSide = ReturnType<typeof getBoundedSides>[number];
interface BoundedPair extends BoundedSide {
  element: HTMLElement;
}

export async function generateOverlapScreenshots(params: Params): Promise<number[]> {
  return params.page.evaluate(async (containers) => {
    const indexes: number[] = [];
    // Run promises sequentially to make sure the reset for the previous overflow
    // happens before the next one:
    for (const [index, container] of Object.entries(Array.from(containers))) {
      if (await generateOverlap(container, Number(index))) {
        indexes.push(Number(index));
      }
    }

    return indexes;

    // BODY ENDS----------------------------------------------------------------------
    // BEGIN HELPER FUNCTIONS:

    async function generateOverlap(container: HTMLElement, idx: number): Promise<boolean> {
      const { viewport } = await getTaskData();

      //const children = (Array.from(container.children) as HTMLElement[]).filter((element) => elementFilter(viewport, element));
      const allDescendants = Array.from(container.querySelectorAll<HTMLElement>("*"));

      const filteredDescendants = allDescendants.filter((element: HTMLElement) => elementFilter(container, viewport, element));

      const boundedPairs: BoundedPair[] = filteredDescendants.flatMap((element) => {
        const boundedSides = getBoundedSides(element, filteredDescendants);
        if (boundedSides.length === 0) {
          // filter this one out from descendants:
          return [];
        }
        const randomBoundedSide = getRandomElement(boundedSides);
        return [{ element, ...randomBoundedSide }];
      });

      if (boundedPairs.length <= 1) {
        console.log("Not enough descendents for ", idx);

        return false;
      }

      const containerRect = container.getBoundingClientRect().toJSON();
      fixDimensions(container, containerRect);
      // shuffle to introduce variation:
      const shuffledIndices = shuffle(Array.from(boundedPairs.keys()));
      // pick first at from shuffled indices so it's random:
      const { element, otherElement, side } = boundedPairs[getRandomElement(shuffledIndices)];
      const style = window.getComputedStyle(element);

      const minOffset = getCSSSpacingBetween(element, side, otherElement);
      const maxOffset = Math.max(getDistanceBetweenRects(containerRect, side, element.getBoundingClientRect()));

      console.log("OVERLAPS");
      if (minOffset > maxOffset) {
        // this shoul not happen in a normal situation:
        console.log("min bigger than max");
        return false;
      }

      const offset = getRandomInt(minOffset, maxOffset);
      const prevStyle: Pick<CSSStyleDeclaration, "margin" | "zIndex"> = { margin: style.margin, zIndex: style.zIndex };

      Object.assign(element.style, { [`margin${side}`]: `-${offset}px`, zIndex: "100" });

      console.log("Screenshotting", idx);

      await screenshotRect({ rect: containerRect, filepath: `${await getFileNamePrefix()}-${idx}` });

      //reset style:
      Object.assign(element.style, prevStyle);

      return true;
    }

    function getCSSSpacingBetween(element: HTMLElement, side: Side, opposite: HTMLElement): number {
      const style = window.getComputedStyle(element);
      const oppositeStyle = window.getComputedStyle(opposite);
      const distance = parseCSSPixelValue(style[`margin${side}`]) + parseCSSPixelValue(style[`padding${side}`]);
      const oppositeSides: Record<Side, Side> = {
        Right: "Left",
        Left: "Right",
        Top: "Bottom",
        Bottom: "Top"
      };
      const oppositeSide = oppositeSides[side];
      const oppositeDistance =
        parseCSSPixelValue(oppositeStyle[`margin${oppositeSide}`]) + parseCSSPixelValue(oppositeStyle[`padding${oppositeSide}`]);

      return distance + oppositeDistance;
    }

    function elementFilter(container: HTMLElement, viewport: Resolution, child: HTMLElement): boolean {
      return (
        child.nodeType === Node.ELEMENT_NODE && isInViewport(child.getBoundingClientRect(), viewport) && isVisibleInDOM(child, container)
      );
    }
  }, params.containers);
}
