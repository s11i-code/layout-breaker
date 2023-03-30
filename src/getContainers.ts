import { ContainerList } from "./types";
import { Page } from "puppeteer";

export async function getContainers(page: Page): Promise<ContainerList> {
  return page.evaluateHandle(async () => {
    function isOptimalSize(bounding: DOMRect): boolean {
      const { width, height } = bounding;
      const area = width * height;
      const viewportArea = viewport.width * viewport.height;
      const widthIsOver20Percent = width > viewport.width * 0.2;
      const heightIsOver50Px = height > 50;
      const areaIsUnder50Percent = area < viewportArea * 0.5;
      return widthIsOver20Percent && heightIsOver50Px && areaIsUnder50Percent;
    }

    const { containerIndexes, viewport } = await getTaskData();
    const selectors = "div, section, article, ul, ol, dl, aside, header, footer, button, nav";
    const containersSeen = {};
    const containers = Array.from(document.querySelectorAll<HTMLElement>(selectors)).filter((container: HTMLElement) => {
      const rect = container.getBoundingClientRect();
      return (
        isInViewport(rect, viewport) && isOptimalSize(rect) && isVisibleInDOM(container) && !elementAlreadyAdded(container, containersSeen)
      );
    });

    debugger;
    if (containerIndexes) {
      return containerIndexes.map((index) => containers[index]);
    }

    return containers;
  });
}
