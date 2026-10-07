import { createWorker } from "tesseract.js";
interface Worker {
  recognize(
    image: string,
  ): Promise<{ data: { text: string; confidence: number } }>;
  setParameters?(parameters: Record<string, string | number>): Promise<unknown>;
  terminate(): Promise<unknown>;
}
export class OcrWorkerSession {
  private worker: Promise<Worker> | null = null;
  private busy = false;
  private idle: ReturnType<typeof setTimeout> | null = null;
  constructor(
    private factory: () => Promise<Worker>,
    private idleMs = 60000,
  ) {}
  async run<T>(
    action: (worker: Worker) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    if (this.busy) throw new Error("Ya hay una lectura OCR en curso.");
    if (signal?.aborted)
      throw new DOMException("Lectura cancelada", "AbortError");
    this.busy = true;
    if (this.idle) clearTimeout(this.idle);
    const promise = (this.worker ||= this.factory());
    let cancelled = false;
    let rejectAbort: (error: Error) => void = () => {};
    const interrupted = new Promise<never>((_, reject) => {
      rejectAbort = reject;
    });
    const abort = () => {
      cancelled = true;
      rejectAbort(new DOMException("Lectura cancelada", "AbortError"));
      if (this.worker === promise) this.worker = null;
      void promise.then((worker) => worker.terminate()).catch(() => {});
    };
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const worker = await Promise.race([promise, interrupted]);
      if (cancelled) throw new DOMException("Lectura cancelada", "AbortError");
      const result = await Promise.race([action(worker), interrupted]);
      if (cancelled) throw new DOMException("Lectura cancelada", "AbortError");
      return result;
    } catch (error) {
      if (this.worker === promise) {
        this.worker = null;
        void promise.then((worker) => worker.terminate()).catch(() => {});
      }
      throw error;
    } finally {
      signal?.removeEventListener("abort", abort);
      this.busy = false;
      if (this.worker)
        this.idle = setTimeout(() => void this.dispose(), this.idleMs);
    }
  }
  async dispose() {
    if (this.idle) clearTimeout(this.idle);
    this.idle = null;
    const promise = this.worker;
    this.worker = null;
    await promise?.then((worker) => worker.terminate());
  }
}
export const OCR_LANGUAGES = {
  "spa+eng": "Español / inglés (MRZ internacional)",
  "por+eng": "Portugués / inglés",
  "fra+eng": "Francés / inglés",
  "deu+eng": "Alemán / inglés",
  "ita+eng": "Italiano / inglés",
  "rus+eng": "Ruso / inglés",
  "ara+eng": "Árabe / inglés",
  "chi_sim+eng": "Chino simplificado / inglés",
  "jpn+eng": "Japonés / inglés",
} as const;
export type OcrLanguage = keyof typeof OCR_LANGUAGES;
function makeSession(language: OcrLanguage) {
  return new OcrWorkerSession(async () => {
    const worker = await createWorker(language);
    return {
      recognize: (image: string) =>
        worker.recognize(image, { rotateAuto: true }),
      setParameters: (parameters: Record<string, string | number>) =>
        worker.setParameters(
          parameters as Parameters<typeof worker.setParameters>[0],
        ),
      terminate: () => worker.terminate(),
    };
  });
}
export const ocrWorkerSession = makeSession("spa+eng");
let alternate: { language: OcrLanguage; session: OcrWorkerSession } | null =
  null;
export function getOcrSession(language: OcrLanguage) {
  if (language === "spa+eng") return ocrWorkerSession;
  if (alternate?.language !== language) {
    void alternate?.session.dispose();
    alternate = { language, session: makeSession(language) };
  }
  return alternate.session;
}
