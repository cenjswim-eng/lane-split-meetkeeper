import { describe, it, expect } from "vitest";
import { automaticAccessMembers, parseRosterLines } from "@/lib/club-document";
describe("automatic club document registration", () => {
  it("registers supplied Access coaches without guessing unrelated tables", () => {
    const result = automaticAccessMembers({ name: "club.mdb", tables: [{ name: "Coaches", columns: ["first_name","last_name","id"], rows: [{ first_name:"Ana", last_name:"Perez", id:1 }] }, { name:"Meet",columns:["name"],rows:[{name:"Copa"}]}] });
    expect(result.members).toHaveLength(1); expect(result.members[0]).toMatchObject({ first_name:"Ana",member_role:"entrenador",source_key:"coaches:1" });
  });
  it("extracts explicit PDF roster information and deduplicates repeated rows", () => {
    const rows = parseRosterLines(["Nombre | Apellido | Tipo | Correo | Teléfono", "Ana | Perez | delegado | ana@example.org | 04120000000", "Ana | Perez | delegado | ana@example.org | 04120000000"]);
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ first_name:"Ana",last_name:"Perez",member_role:"delegado",email:"ana@example.org",phone:"04120000000" });
  });
  it("does not invent members from arbitrary PDF prose", () => { expect(parseRosterLines(["Informe de Ana Perez sobre el club"])).toEqual([]); });
});