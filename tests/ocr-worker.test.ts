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

test("a synchronous OCR factory failure does not lock later scans", async () => {
  let calls = 0;
  const session = new OcrWorkerSession(() => {
    if (++calls === 1) throw new Error("Model initialization failed");
    return Promise.resolve({
      recognize: async () => ({ data: { text: "OK", confidence: 99 } }),
      terminate: async () => {},
    });
  });
  await assert.rejects(
    session.run(async (worker) => worker.recognize("image")),
    /initialization failed/,
  );
  assert.equal(
    (await session.run((worker) => worker.recognize("image"))).data.text,
    "OK",
  );
  await session.dispose();
});

test("preparing OCR during image review reuses one worker for the actual scan", async () => {
  let created = 0;
  const session = new OcrWorkerSession(async () => {
    created++;
    return {
      recognize: async () => ({ data: { text: "READY", confidence: 95 } }),
      terminate: async () => {},
    };
  });
  try {
    await Promise.all([session.warm(), session.warm()]);
    assert.equal(
      (await session.run((worker) => worker.recognize("image"))).data.text,
      "READY",
    );
    assert.equal(created, 1);
  } finally {
    await session.dispose();
  }
});
