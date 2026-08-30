const activeWorkers = new Set<Worker>();

export function registerWorker(worker: Worker): void {
  activeWorkers.add(worker);
}

export function releaseWorker(worker: Worker): void {
  activeWorkers.delete(worker);
}

export function terminateStocklessWorkers(): void {
  for (const worker of activeWorkers) worker.terminate();
  activeWorkers.clear();
}
