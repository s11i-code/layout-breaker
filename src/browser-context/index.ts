/* eslint-disable @typescript-eslint/no-unused-vars */

import { Resolution } from "../types";

// RANDOM STUFF
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + min;
}

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(array: T[]): T[] {
  return array.sort((a, b) => 0.5 - Math.random());
}

type ElementFilter = (element: HTMLElement) => boolean;

// get all descendants which do not have any children (aka leaf nodes)
function getDescendentLeafNodes(parent: HTMLElement, filter: ElementFilter = () => true, aggregate: HTMLElement[] = []): HTMLElement[] {
  if (parent.childElementCount === 0) {
    return [parent];
  }

  const children = Array.from(parent.children) as HTMLElement[];
  const filteredChildren = children.filter((element: HTMLElement) => filter(element));
  const descendents = filteredChildren.flatMap((child) => getDescendentLeafNodes(child, filter, aggregate));

  return [...aggregate, ...descendents];
}

function fixDimensions(element: HTMLElement, rect = element.getBoundingClientRect()): void {
  const constraintStyles: Partial<CSSStyleDeclaration> = {
    maxWidth: `${rect.width}px`,
    width: `${rect.width}px`,
    maxHeight: `${rect.height}px`,
    height: `${rect.height}px`
  };
  const isInline = window.getComputedStyle(element)["display"] === "inline";
  if (isInline) {
    // size constraints do no work with inline elements:
    constraintStyles["display"] = "inline-block";
  }
  Object.assign(element.style, constraintStyles);
}

function getClosestBlockParent(startElement: HTMLElement): HTMLElement {
  let element: HTMLElement | null = startElement;
  while (element?.parentElement && window.getComputedStyle(element)["display"] !== "block") {
    element = element.parentElement;
  }
  return element;
}

function elementAlreadyAdded(element: HTMLElement, previouslyAdded: Record<string, number>, dupesAllowed = 1): boolean {
  // dedupe base on the bounding rect stringification, so we don't get the same layout bug several times:
  const key = JSON.stringify(element.getBoundingClientRect());
  const dupeCount = previouslyAdded[key] || 0;
  previouslyAdded[key] = dupeCount + 1;
  return dupeCount >= dupesAllowed;
}

function isVisible(element: HTMLElement): boolean {
  // todo: check these techniques: https://webaim.org/techniques/css/invisiblecontent
  const takesSpace = [element.offsetWidth, element.offsetHeight].every((val) => val > 0);
  const { display, visibility, opacity, clip } = window.getComputedStyle(element);
  const visible = takesSpace && visibility !== "hidden" && display !== "none" && opacity !== "0" && clip !== "rect(1px, 1px, 1px, 1px)";

  if (!visible) {
    return false;
  }
  return true;
}

function isInViewport(bounding: DOMRect, viewport: Resolution): boolean {
  return bounding.top >= 0 && bounding.left >= 0 && bounding.right <= viewport.width && bounding.bottom <= viewport.height;
}

// check ancestor chain up to body element to because all ancestors must be visible for the element to be visible:
function isVisibleInDOM(startElement: HTMLElement): boolean {
  let element: HTMLElement | null = startElement;
  while (element && !element.tagName.match(/body/i)) {
    if (!isVisible(element)) {
      return false;
    }
    element = element.parentElement;
  }
  return true;
}

declare global {
  /*~
   */

  function getClosestBlockParent(startElement: HTMLElement): HTMLElement;

  function getRandomInt(lower: number, upper: number): number;

  function shuffle<T>(array: T[]): T[];

  function getRandomElement<T>(arr: T[]): T;

  function isVisibleInDOM(elem: HTMLElement): boolean;

  function isInViewport(bounding: DOMRect, viewport: Resolution): boolean;

  function isVisible(element: HTMLElement): boolean;

  function getDescendentLeafNodes(parent: HTMLElement, filter?: ElementFilter, aggregate?: HTMLElement[]): HTMLElement[];

  function fixDimensions(startElement: HTMLElement, rect: DOMRect): void;

  function elementAlreadyAdded(element: HTMLElement, previouslyAdded: Record<string, number>, dupesAllowed?: number): boolean;

  function getBoundedSides(element: HTMLElement, others: HTMLElement[]): Side[];
}
