import { PuppeteerLaunchOptions } from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import { TaskFunction } from "puppeteer-cluster/dist/Cluster";
import { TaskData } from "./types";

type ClusterConfig = Parameters<typeof Cluster.launch>[0];

export async function createCluster(
  task: TaskFunction<TaskData, void>,
  debug: boolean | undefined,
  puppeteerOptions: PuppeteerLaunchOptions,
  exit: (cluster: Cluster) => void
): Promise<Cluster> {
  const clusterConfig: ClusterConfig = {
    monitor: true,
    puppeteerOptions,
    maxConcurrency: debug ? 1 : 4,
    timeout: debug ? 15000000 : 100000,
    concurrency: Cluster.CONCURRENCY_CONTEXT
  };

  const cluster = await Cluster.launch(clusterConfig);

  await cluster.task(task);

  cluster.on("taskerror", (err, data) => {
    console.error(
      `------ERROR-WITH-CLUSTER-CRAWLING ${data.manipulation.toUpperCase()} ${data.site}-${data.viewport.width}x${data.viewport.height}`
    );
    console.log(`\n${err.filename}`);
    console.log(`\n${err.message}`);
    console.log(err.stack);
    exit(cluster);
  });

  return cluster;
}
