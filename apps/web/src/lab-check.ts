import type { Circuit } from "@literal/core";
import type { LabReport } from "./curriculum.ts";
export function checkLabAsync(
  id: string,
  circuit: Circuit,
): Promise<LabReport> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL("./lab-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<LabReport>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      worker.terminate();
      resolve({
        passed: false,
        message: "Could not check this circuit. " + event.message,
      });
    };
    worker.postMessage({ id, circuit });
  });
}
