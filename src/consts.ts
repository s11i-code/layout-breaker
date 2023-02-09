import { Manipulation } from "./types";

export const UNTOUCHED: Manipulation = "untouched";
export const OVERFLOW: Manipulation = "overflow";
export const OVERLAP: Manipulation = "overlap";
export const ALL_MANIPULATIONS = [UNTOUCHED, OVERFLOW, OVERLAP] as const;
