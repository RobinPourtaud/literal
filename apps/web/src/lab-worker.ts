import { checkLab } from "./curriculum.ts";
self.onmessage = (event) => {
  self.postMessage(checkLab(event.data.id, event.data.circuit));
};
