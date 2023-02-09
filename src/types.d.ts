import { JSHandle } from "puppeteer";
export type Resolution = {
  width: number;
  height: number;
};

export type ContainerList = JSHandle<HTMLElement[]>;

export type Manipulation = "overflow" | "overlap" | "untouched";

interface TaskData {
  site: string;
  viewport: Resolution;
  baseFolder: string;
  manipulation: Manipulation;
  containerIndexes?: number[];
}

export type Rect = { width: number; height: number };

export type Side = "left" | "right" | "top" | "bottom";
