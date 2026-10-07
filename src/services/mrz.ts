import icaoCountries from "../data/icaoCountries.json";
import { parseCalendarDate } from "./validation";

const weights = [7, 3, 1];
export function checkDigit(value: string): string {
  return String(
    [...value].reduce((sum, character, index) => {
      const code =
        character === "<"
          ? 0
          : /\d/.test(character)
            ? Number(character)
            : character.charCodeAt(0) - 55;
      return sum + code * weights[index % 3];
    }, 0) % 10,
  );
}

export function validateMrz(lines: string[]): string[] {
  const warnings: string[] = [];
  const verify = (value: string, digit: string, label: string) => {
    if (!/^\d$/.test(digit) || checkDigit(value) !== digit)
      warnings.push(
        `MRZ: verifica ${label}; el dígito de control no coincide.`,
      );
  };
  const [a = "", b = ""] = lines;
  if (lines.length === 3 && lines.every((line) => line.length === 30)) {
    verify(a.slice(5, 14), a[14], "número de documento");
    verify(b.slice(0, 6), b[6], "nacimiento");
    verify(b.slice(8, 14), b[14], "vencimiento");
    verify(
      a.slice(5, 30) + b.slice(0, 7) + b.slice(8, 15) + b.slice(18, 29),
      b[29],
      "control compuesto",
    );
  } else if (
    lines.length === 2 &&
    a.length === b.length &&
    [36, 44].includes(a.length)
  ) {
    verify(b.slice(0, 9), b[9], "número de documento");
    verify(b.slice(13, 19), b[19], "nacimiento");
    verify(b.slice(21, 27), b[27], "vencimiento");
    if (b.length === 44) {
      if (b[42] !== "<" || b.slice(28, 42).replace(/</g, ""))
        verify(b.slice(28, 42), b[42], "datos personales");
      verify(
        b.slice(0, 10) + b.slice(13, 20) + b.slice(21, 43),
        b[43],
        "control compuesto",
      );
    } else
      verify(
        b.slice(0, 10) + b.slice(13, 20) + b.slice(21, 35),
        b[35],
        "control compuesto",
      );
  } else
    warnings.push("MRZ incompleta: verifica todos los campos de identidad.");
  return warnings;
}

export function mrzDate(value: string, birth: boolean): string {
  if (!/^\d{6}$/.test(value)) return "";
  const currentYear = new Date().getUTCFullYear();
  let year = 2000 + Number(value.slice(0, 2));
  if (birth && year > currentYear) year -= 100;
  const result = `${year}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
  return parseCalendarDate(result) ? result : "";
}

export function countryName(code: string): string {
  const normalized = code.toUpperCase().replace(/</g, "").trim();
  const region = (icaoCountries as Record<string, string>)[normalized];
  if (!region) return normalized;
  return (
    new Intl.DisplayNames(["es"], { type: "region" })
      .of(region)
      ?.toUpperCase() || normalized
  );
}

// Only numeric MRZ positions are corrected. Letters in names and document numbers remain intact.
export function normalizeMrzText(raw: string): string {
  const lines = raw
    .toUpperCase()
    .split(/\r?\n/)
    .map((line) => line.replace(/[«‹〈]/g, "<").replace(/\s/g, ""));
  const numeric = (line: string, ranges: [number, number][]) => {
    const characters = [...line];
    for (const [start, end] of ranges)
      for (let i = start; i < end; i++) {
        characters[i] =
          (
            {
              O: "0",
              Q: "0",
              D: "0",
              I: "1",
              L: "1",
              Z: "2",
              S: "5",
              G: "6",
              B: "8",
            } as Record<string, string>
          )[characters[i]] || characters[i];
      }
    return characters.join("");
  };
  for (let i = 1; i < lines.length; i++) {
    const previous = lines[i - 1],
      current = lines[i];
    if (
      /^P[<A-Z]/.test(previous) &&
      previous.length === 44 &&
      current.length === 44
    )
      lines[i] = numeric(current, [
        [9, 10],
        [13, 20],
        [21, 28],
        [42, 44],
      ]);
    else if (
      /^[IAC]/.test(previous) &&
      previous.length === 36 &&
      current.length === 36
    )
      lines[i] = numeric(current, [
        [9, 10],
        [13, 20],
        [21, 28],
        [35, 36],
      ]);
    else if (
      /^[IAC]/.test(previous) &&
      previous.length === 30 &&
      current.length === 30
    ) {
      lines[i - 1] = numeric(previous, [[14, 15]]);
      lines[i] = numeric(current, [
        [0, 7],
        [8, 15],
        [29, 30],
      ]);
      i++; // The third TD1 line contains names, not numeric fields.
    }
  }
  return lines.join("\n");
}
