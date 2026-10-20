import { test } from "node:test";
import assert from "node:assert/strict";
import { extractWithTesseract } from "../src/services/ocrService";
import { ocrWorkerSession } from "../src/services/ocrWorker";

const text =
  "CEDULA DE IDENTIDAD\nNumero de identidad: 8-123-4567\nNombre completo: MARIA JOSE GONZALEZ\nFecha de nacimiento: 15/06/2011\nSexo: F\nFecha de vencimiento: 01/01/2024";
const prepared = {
  enhanced: "ENHANCED",
  original: "ORIGINAL",
  binarized: "BINARY",
  mrz: "MRZ",
};
test("complete high confidence identity needs one recognition; uncertain fields trigger recovery", async () => {
  const original = ocrWorkerSession.run;
  try {
    for (const scenario of [
      "complete",
      "incomplete",
      "low-confidence",
    ] as const) {
      const calls: string[] = [];
      ocrWorkerSession.run = async (action) =>
        action({
          setParameters: async () => {},
          terminate: async () => {},
          recognize: async (image) => {
            calls.push(image);
            const first = calls.length === 1;
            return {
              data: {
                text:
                  first && scenario === "incomplete"
                    ? text.replace("Fecha de vencimiento: 01/01/2024", "")
                    : text,
                confidence: first && scenario === "low-confidence" ? 60 : 96,
              },
            };
          },
        });
      const result = await extractWithTesseract(
        "ENHANCED",
        undefined,
        prepared,
      );
      assert.equal(result.passportNumber, "8-123-4567");
      assert.equal(result.expiryDate, "2024-01-01");
      assert.equal(result.fullName, "MARIA JOSE GONZALEZ");
      assert.deepEqual(
        calls,
        scenario === "complete" ? ["ENHANCED"] : ["ENHANCED", "BINARY"],
      );
    }
  } finally {
    ocrWorkerSession.run = original;
  }
});

test("a failed MRZ check triggers recovery even beside confident visual fields", async () => {
  const original = ocrWorkerSession.run;
  const mrz = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10";
  const calls: string[] = [];
  try {
    ocrWorkerSession.run = async action => action({
      setParameters: async () => {}, terminate: async () => {},
      recognize: async image => {
        calls.push(image);
        return { data: { text: image === "ENHANCED" ? text + "\n" + mrz.replace("L898902C3", "L898902C4") : mrz, confidence: 96 } };
      },
    });
    const result = await extractWithTesseract("ENHANCED", undefined, prepared);
    assert.deepEqual(calls, ["ENHANCED", "MRZ"]);
    assert.equal(result.passportNumber, "L898902C3");
    assert.ok(result.warnings?.some(warning => warning.includes("difieren")));
  } finally { ocrWorkerSession.run = original; }
});
