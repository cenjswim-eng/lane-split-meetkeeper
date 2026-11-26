import { describe, it, expect } from "vitest";
import { parseStandardsDocument } from "@/lib/standards-document";

describe("mínimas venezolanas en pares F/M", () => {
  it("asigna 10 tiempos a 5 categorías F/M", () => {
    const { rows } = parseStandardsDocument(["100 LIBRE 1.18.77 1.17.80 1.11.74 1.08.21 1.09.66 1.02.45 1.08.03 59.86 1.08.03 59.86"], "LCM");
    expect(rows).toHaveLength(10);
    expect(rows[0]).toMatchObject({ gender: "F", time: "1:18.77", distance: 100, stroke: 1 });
    expect(rows[7]).toMatchObject({ gender: "M", time: "59.86" });
  });
  it("filas cortas se asignan a las categorías mayores", () => {
    const { rows } = parseStandardsDocument(["1500 LIBRE 21.31.67 19.27.45 21.16.78 18.31.67 21.16.78 18.31.67"], "LCM");
    expect(rows).toHaveLength(6);
    expect(rows[0]!.time).toBe("21:31.67");
    expect(rows[5]!.category).toMatch(/M[aá]xima/i);
  });
});

describe("encabezado con una sola categoría reconocida", () => {
  it("igual asigna los pares F/M", () => {
    const { rows } = parseStandardsDocument(["INFANTIL JUVENIL MAXIMA", "50 LIBRE 35.79 34.68 32.03 30.33 32.01 28.76 31.45 27.15 31.45 27.15"], "LCM");
    expect(rows).toHaveLength(10);
  });
});
