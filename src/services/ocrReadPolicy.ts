import type { ExtractionResult } from "../types";
import { parseCalendarDate } from "./validation";

// Stop redundant scans only when the first pass contains every essential field.
export function hasCompleteVisualReading(
  value: Partial<ExtractionResult> | undefined,
  confidence: number,
) {
  const birth = parseCalendarDate(value?.birthDate || "");
  return Boolean(
    value &&
      confidence >= 90 &&
      value.fullName &&
      value.passportNumber &&
      value.docType &&
      value.docType !== "otro" &&
      /^[MFX]$/.test(value.sex || "") &&
      birth && +birth <= Date.now() &&
      parseCalendarDate(value.expiryDate || ""),
  );
}
