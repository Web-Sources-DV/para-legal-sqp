import { test } from "node:test";
import assert from "node:assert/strict";
import { OcrWorkerSession } from "../src/services/ocrWorker";
test("OCR worker is reused and explicitly released", async () => {
  let created = 0,
    terminated = 0;
  const session = new OcrWorkerSession(async () => {
    created++;
    return {
      recognize: async () => ({ data: { text: "TEST", confidence: 90 } }),
      terminate: async () => {
        terminated++;
      },
    };
  });
  try {
    await session.run((worker) => worker.recognize("image"));
    await session.run((worker) => worker.recognize("image"));
    assert.equal(created, 1);
  } finally {
    await session.dispose();
  }
  assert.equal(terminated, 1);
});
test("cancelling a stalled recognition rejects immediately and terminates the worker", async () => {
  let terminated = 0;
  const session = new OcrWorkerSession(async () => ({
    recognize: () => new Promise(() => {}),
    terminate: async () => {
      terminated++;
    },
  }));
  const controller = new AbortController();
  const result = session.run(
    (worker) => worker.recognize("image"),
    controller.signal,
  );
  await Promise.resolve();
  controller.abort();
  await assert.rejects(
    result,
    (error) => (error as Error).name === "AbortError",
  );
  await Promise.resolve();
  assert.equal(terminated, 1);
  await session.dispose();
});
