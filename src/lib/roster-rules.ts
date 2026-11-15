import { z } from "zod";
import { ageAtDec31 } from "./swim";
import { SWIM_CATEGORIES, type SwimCategory } from "./standard-rules";

export const formatTeamCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
export const clubSchema = z.object({
  team_code: z.string().regex(/^[A-Z0-9]{2,5}$/, "Código: 2–5 letras o números."),
  full_name: z.string().trim().min(1, "Indica el nombre.").max(30, "Máximo 30 caracteres."),
  short_name: z.string().max(16, "Máximo 16 caracteres."),
  region_lsc: z.string().max(40), country_code: z.string().regex(/^[A-Z]{3}$/, "Usa tres letras."),
  head_coach: z.string().max(100), contact_email: z.union([z.literal(""), z.email("Correo inválido.")]),
  contact_phone: z.string().max(40), team_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hexadecimal inválido."),
  is_unattached: z.boolean(),
  team_type: z.enum(['AGE_GROUP','MASTERS','HIGH_SCHOOL','COLLEGE','OPEN']), division: z.string().max(10), region: z.string().max(10),
});
export const athleteSchema = z.object({
  last_name: z.string().trim().min(1, "Indica el apellido.").max(100), first_name: z.string().trim().min(1, "Indica el nombre.").max(100),
  middle_initial: z.string().max(1), preferred_name: z.string().max(40), gender: z.enum(["M", "F"]),
  birth_date: z.string().refine(s => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s && s <= new Date().toISOString().slice(0,10), "Fecha de nacimiento inválida."),
  federation_id: z.string().max(12, "Máximo 12 caracteres para SDIF."), para_classification: z.string().max(40), is_active: z.boolean(), club_id: z.string(),
});
export type ClubFormValues = z.infer<typeof clubSchema>;
export type AthleteFormValues = z.infer<typeof athleteSchema>;
export function generateFederationId(first: string, last: string, birth: string, gender: 'M'|'F') {
  const letters = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!letters(first) || letters(last).length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) throw new Error("Completa nombre, apellido y nacimiento para generar el ID.");
  if (!['M','F'].includes(gender)) throw new Error('Completa el sexo para generar el ID.');
  return `${letters(first).slice(0,1)}${letters(last).slice(0,2)}${birth.slice(8,10)}${birth.slice(5,7)}${birth.slice(2,4)}${gender}`;
}
export function rosterCategory(birth: string | null, year: number, categories: readonly SwimCategory[] = SWIM_CATEGORIES) {
  const age = ageAtDec31(birth,year);
  if (age == null || age < 0) return "—";
  const category = categories.find(c => (c.age_min == null || age >= c.age_min) && (c.age_max == null || age <= c.age_max));
  return category?.name ?? (age <= 9 ? "Pre-Infantil" : "Sin categoría");
}