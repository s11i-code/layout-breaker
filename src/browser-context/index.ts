import { Rect, Resolution, Side } from "../types";

// RANDOM STUFF
function getRandomInt(min: number, max: number): number {
  if ([min, max].some((val) => typeof val !== "number") || min > max) {
    throw `Invalid parameters for getRandomInt, min: ${min}, max: ${max}`;
  }
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
function getDescendents(
  parent: HTMLElement,
  filter: ElementFilter = () => true,
  onlyLeafNodes = false,
  aggregate: HTMLElement[] = []
): HTMLElement[] {
  const children = Array.from(parent.children) as HTMLElement[];
  const filteredChildren = children.filter((element: HTMLElement) => filter(element));
  if (filteredChildren.length === 0) {
    return [parent];
  }
  const descendents = filteredChildren.flatMap((child) => getDescendents(child, filter, onlyLeafNodes, aggregate));

  return [...aggregate, ...(onlyLeafNodes ? [] : filteredChildren), ...descendents];
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

function getClosestAncestor(startElement: HTMLElement, condition: (el: HTMLElement) => boolean): HTMLElement | null {
  let element: HTMLElement | null = startElement;
  while (!condition(element)) {
    if (!element.parentElement) {
      return null;
    }
    element = element?.parentElement;
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
  const takesSpace = [element.offsetWidth, element.offsetHeight].every((val) => val > 1);
  const { display, visibility, opacity, clip } = window.getComputedStyle(element);
  const isClipped = ["rect(0px, 0px, 0px, 0px)", "rect(1px, 1px, 1px, 1px)"].includes(clip);
  const visible = takesSpace && visibility !== "hidden" && display !== "none" && opacity !== "0" && !isClipped;

  return !!visible;
}

function isInViewport(bounding: DOMRect, viewport: Resolution): boolean {
  return bounding.top >= 0 && bounding.left >= 0 && bounding.right <= viewport.width && bounding.bottom <= viewport.height;
}

// check ancestor chain up to body element to because all ancestors must be visible for the element to be visible:
function isVisibleInDOM(startElement: HTMLElement, upTo = document.body): boolean {
  let element: HTMLElement | null = startElement;
  while (element && !element.isEqualNode(upTo)) {
    if (!isVisible(element)) {
      return false;
    }
    element = element.parentElement;
  }
  return true;
}

export function parseCSSPixelValue(value: string): number | typeof NaN {
  return parseInt(value.split("px")[0]);
}

export function getDistanceBetweenRects(outerReact: DOMRect, side: Side, innerRect: DOMRect): number {
  // hope ts gets smarter about this:
  const sideAsLower: Lowercase<Side> = side.toLowerCase() as Lowercase<Side>;
  const innerDistanceFromViewport = innerRect[sideAsLower];
  const outerDistanceFromViewport = outerReact[sideAsLower];

  if (["Left", "Top"].includes(side)) {
    return Math.round(innerDistanceFromViewport - outerDistanceFromViewport);
  }
  return Math.round(outerDistanceFromViewport - innerDistanceFromViewport);
}

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function makeSentences(words: string[]) {
  return words
    .reduce<string>((prev, current) => {
      //capitalize words that follow a sentence-ending character (.?!)
      const isBeforeSentenceEnd = /[\.\?\!]$/.test(prev);
      const isFirst = prev === "";
      return isFirst || isBeforeSentenceEnd ? `${prev} ${capitalize(current)}` : `${prev} ${current}`;
    }, "")
    .trim();

  // also add a dot after the sentence itself if it doesn't have one:
}

interface BoundedSide {
  side: Side;
  otherElement: HTMLElement;
}

export function getBoundedSides(element: HTMLElement, others: HTMLElement[]): Array<BoundedSide> {
  const style = window.getComputedStyle(element);
  const bounding = element.getBoundingClientRect();

  return others.flatMap<BoundedSide>((otherElement) => {
    const otherBounding = otherElement.getBoundingClientRect();
    const otherStyle = window.getComputedStyle(otherElement);

    // take margins into account:
    const elementLeft = Math.round(bounding.left - parseInt(style.marginLeft));
    const elementRight = Math.round(bounding.right + parseInt(style.marginRight));
    const elementTop = Math.round(bounding.top - parseInt(style.marginTop));
    const elementBottom = Math.round(bounding.bottom + parseInt(style.marginBottom));

    const otherLeft = Math.round(otherBounding.left - parseInt(otherStyle.marginLeft));
    const otherRight = Math.round(otherBounding.right + parseInt(otherStyle.marginRight));
    const otherTop = Math.round(otherBounding.top - parseInt(otherStyle.marginTop));
    const otherBottom = Math.round(otherBounding.bottom + parseInt(otherStyle.marginBottom));

    const verticallyOverlapping = isOverlapping([elementTop, elementBottom], [otherTop, otherBottom]);
    const horizontallyOverlapping = isOverlapping([elementLeft, elementRight], [otherLeft, otherRight]);
    // element right of other
    if (elementLeft === otherRight && verticallyOverlapping) {
      return [{ side: "Left", otherElement }];
    }

    // element left of other
    if (elementRight === otherLeft && verticallyOverlapping) {
      return [{ side: "Right", otherElement }];
    }

    //  element on top of other
    if (elementBottom === otherTop && horizontallyOverlapping) {
      return [{ side: "Bottom", otherElement }];
    }
    // element below other
    if (elementTop === otherBottom && horizontallyOverlapping) {
      return [{ side: "Top", otherElement }];
    }

    return [];
  });
}
type CSSProperty = keyof CSSStyleDeclaration;
function getStyle<P extends CSSProperty>(style: CSSStyleDeclaration, properties: P[]): Record<P, CSSStyleDeclaration[P]> {
  // TODO: remove type assertion
  return Object.fromEntries(properties.map((prop: P) => [prop, style[prop]])) as Record<P, CSSStyleDeclaration[P]>;
}

function isOverlapping([start1, end1]: [number, number], [start2, end2]: [number, number]): boolean {
  const startIsLargerThanEnd = start1 > end1 || start2 > end2;
  if ([start1, end1, start2, end2].some((val) => typeof val !== "number") || startIsLargerThanEnd) {
    throw `Invalid parameters for isOverlapping, start: ${start1}, end1: ${end1}, start2: ${start2}, end2: ${end2}`;
  }
  if (end1 <= start2) {
    return false;
  }
  if (end2 <= start1) {
    return false;
  }

  return true;
}

declare global {
  function getDistanceBetweenRects(outerReact: DOMRect, side: Side, innerRect: DOMRect): number;

  function getStyle<P extends CSSProperty>(style: CSSStyleDeclaration, properties: Readonly<P[]>): Record<P, CSSStyleDeclaration[P]>;

  function getClosestAncestor(startElement: HTMLElement, condition: (el: HTMLElement) => boolean): HTMLElement | undefined;

  function parseCSSPixelValue(value: string): number | typeof NaN;

  function getRandomInt(lower: number, upper: number): number;

  function shuffle<T>(array: T[]): T[];

  function getRandomElement<T>(arr: T[]): T;

  function isVisibleInDOM(startElement: HTMLElement, upTo?: HTMLElement): boolean;

  function isInViewport(bounding: DOMRect, viewport: Resolution): boolean;

  function isVisible(element: HTMLElement): boolean;

  function getDescendents(parent: HTMLElement, filter?: ElementFilter, onlyLeafNodes?: boolean, aggregate?: HTMLElement[]): HTMLElement[];

  function fixDimensions(element: HTMLElement, rect?: Rect): void;

  function elementAlreadyAdded(element: HTMLElement, previouslyAdded: Record<string, number>, dupesAllowed?: number): boolean;

  function getBoundedSides(element: HTMLElement, others: HTMLElement[]): Array<BoundedSide>;

  function makeSentences(words: string[]): string;
}
