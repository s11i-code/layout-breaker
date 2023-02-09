import minimist from "minimist";
import { ALL_MANIPULATIONS } from "./consts";
import { Manipulation } from "./types";

function isManipulation(item: any): item is Manipulation {
  return ALL_MANIPULATIONS.includes(item);
}

const ARGS_KEYS = ["containerindexes", "folder", "debug", "sites", "manipulations", "_"] as const;
type ArgKey = typeof ARGS_KEYS[number];
// minimist annoyingly parses number-ish values to numbers...:
type ArgValue = string | number;
type RawArgs = Partial<Record<ArgKey, ArgValue>>;

interface ParsedArgs {
  folder?: string;
  sites?: string[];
  debug?: boolean;
  manipulations?: Manipulation[];
  containerIndexes: number[];
}

type Mapper<T> = (value: string) => T;

const noOp = (p: any) => p;

function parse<T = string>(val: ArgValue, mapper: Mapper<T> = noOp): T[] {
  return `${val}`
    .split(",")
    .map((_) => _.trim())
    .map(mapper);
}

export function parseArgs(): ParsedArgs {
  const rawArgs = minimist<RawArgs>(process.argv.slice(2)) as RawArgs;
  const unknownArgs = Object.keys(rawArgs).filter((argKey) => !ARGS_KEYS.includes(argKey as ArgKey));
  const parsedManipulations = rawArgs.manipulations ? parse<Manipulation>(rawArgs.manipulations) : undefined;
  const parsedIndexes =
    rawArgs.containerindexes || rawArgs.containerindexes === 0 ? parse<number>(rawArgs.containerindexes, parseFloat) : undefined;
  const parsedSites = rawArgs.sites ? parse(rawArgs.sites) : undefined;

  if (unknownArgs.length > 0) {
    console.error(
      `Unknown command line argument(s): ${unknownArgs.join(", ")}. Allowed arguments are: ${ARGS_KEYS.filter((x) => x !== "_").join(
        ", "
      )}.`
    );
    process.exit();
  }

  if (parsedManipulations?.some((manipulation) => !isManipulation(manipulation))) {
    console.error(
      `Incorrect manipulations argument: ${rawArgs.manipulations}. Must be a comma-separated list of the following values ${ALL_MANIPULATIONS}`
    );
    process.exit();
  }

  if (parsedSites && parsedSites.some((site) => !/^https?/.test(site))) {
    console.error(`Incorrect sites argument: ${rawArgs.sites}. Only a comma separated list of URLs allowed.`);
    process.exit();
  }

  if (parsedIndexes?.some((index) => !Number.isInteger(index))) {
    console.error(`Incorrect container indexes: ${rawArgs.containerindexes}. Ony a comma-separated list of integers are allowed.`);
    process.exit();
  }

  return {
    debug: !!rawArgs.debug,
    sites: parsedSites,
    folder: typeof rawArgs.folder === "number" ? `${rawArgs.folder}` : rawArgs.folder,
    containerIndexes: parsedIndexes as number[],
    manipulations: parsedManipulations
  };
}
