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
  const countries: Record<string, string> = {
    PAN: "PANAMÁ",
    ESP: "ESPAÑA",
    COL: "COLOMBIA",
    MEX: "MÉXICO",
    VEN: "VENEZUELA",
    PER: "PERÚ",
    ARG: "ARGENTINA",
    CHL: "CHILE",
    ECU: "ECUADOR",
    DOM: "REPÚBLICA DOMINICANA",
    CRI: "COSTA RICA",
    GTM: "GUATEMALA",
    HND: "HONDURAS",
    NIC: "NICARAGUA",
    SLV: "EL SALVADOR",
    BOL: "BOLIVIA",
    PRY: "PARAGUAY",
    URY: "URUGUAY",
    CUB: "CUBA",
    USA: "ESTADOS UNIDOS",
    FRA: "FRANCIA",
    ITA: "ITALIA",
    DEU: "ALEMANIA",
    GBR: "REINO UNIDO",
    PRT: "PORTUGAL",
    BRA: "BRASIL",
    CAN: "CANADÁ",
  };
  return countries[code] || code;
}
