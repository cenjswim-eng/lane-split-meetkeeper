import type { ParsedFile, ParsedAthlete } from '@/lib/hytek/types';
import type { ExistingSwimmer, ParseFileResult } from './types';
import { normalizeSwimmerSlug, readSwimFile } from './encodingAndTime';
import { parseHy3File } from './hy3Parser';
import { parseSd3File } from './sd3Parser';
import { aquaPoints } from '@/lib/swim';
export async function parseSwimFile(file: File): Promise<ParseFileResult> {
 const source = await readSwimFile(file);
 const format = /\.hy3$/i.test(source.name) ? 'HY3' : /\.cl2$/i.test(source.name) ? 'CL2' : 'SD3';
 if (!/^(A0|A1|B1)/.test(source.text.trimStart())) throw new Error('El archivo no contiene un encabezado HY-TEK reconocido.');
 const parsed = format === 'HY3' ? parseHy3File(source.text) : parseSd3File(source.text);
 if (!parsed.athletes.length || !parsed.results.length) throw new Error('No se encontraron atletas y pruebas compatibles. Revisa el archivo exportado.');
 if (source.archiveNames.length > 1) parsed.warnings.push(`ZIP: se revisará ${source.name}. Otros archivos: ${source.archiveNames.slice(1).join(', ')}.`);
 return { name: source.name, hash: source.hash, encoding: source.encoding, format, parsed };
}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function reconcileSwimmer(a: ParsedAthlete, existing: ExistingSwimmer[]) {
 const compatible = existing.filter(e => (!a.birthDate || !e.birth_date || a.birthDate === e.birth_date) && (!a.gender || !e.gender || a.gender === e.gender) && (!a.federationId || !e.federation_id || a.federationId === e.federation_id));
 const byId = a.tmId ? compatible.filter(e => e.tm_athlete_id === a.tmId) : [];
 const byFederation = a.federationId ? compatible.filter(e => e.federation_id === a.federationId) : [];
 const byName = a.birthDate ? compatible.filter(e => normalizeSwimmerSlug(e.first_name,e.last_name,e.birth_date) === normalizeSwimmerSlug(a.firstName,a.lastName,a.birthDate)) : [];
 const exact = byId.length ? byId : byFederation.length ? byFederation : byName;
 if (exact.length === 1) return { status: 'existing' as const, match: exact[0], candidates: exact };
 if (exact.length > 1) return { status: 'possible' as const, match: undefined, candidates: exact };
 const candidates = compatible.filter(e=>normalize(e.last_name) === normalize(a.lastName));
 return { status: candidates.length ? 'possible' as const : 'new' as const, match: undefined, candidates };
}
export function prepareImportPayload(file: ParsedFile, fileName: string, hash?: string, clubId?: string, teamCode = 'all', links: Record<string,string> = {}) {
 const athletes = file.athletes
  .filter(a => teamCode === 'all' || a.teamCode === teamCode)
  .map(a => ({
    ...a,
    firstName: (a.firstName || 'Atleta').trim(),
    lastName: (a.lastName || 'Desconocido').trim(),
    linkedAthleteId: links[a.key] ?? null
  }));
 if (!athletes.length) throw new Error('No hay atletas seleccionados o coincidentes para importar.');
 const keys = new Set(athletes.map(a => a.key));
 const today = new Date().toISOString().slice(0, 10);
 const rawName = (file.meet?.name ?? '').trim();
 const fallbackName = fileName ? fileName.replace(/\.[^.]+$/, '').trim() : 'Torneo de Natación';
 const meetName = rawName || fallbackName || 'Torneo de Natación';
 const meetStartDate = file.meet?.startDate || today;
 const meetEndDate = file.meet?.endDate || meetStartDate;
 const meetCourse = (file.meet?.course === 'LCM' || file.meet?.course === 'SCM' || file.meet?.course === 'SCY') ? file.meet.course : 'LCM';
 const sanitizedMeet = {
   ...file.meet,
   name: meetName,
   startDate: meetStartDate,
   endDate: meetEndDate,
   course: meetCourse,
 };
 const results = file.results.filter(r => keys.has(r.athleteKey)).map(r => ({
   ...r,
   course: (r.course === 'LCM' || r.course === 'SCM' || r.course === 'SCY') ? r.course : sanitizedMeet.course,
   round: (r.round === 'F' || r.round === 'P' || r.round === 'S') ? r.round : 'F',
   status: r.status ?? (r.isDq ? 'DQ' : r.finalMs == null ? 'NT' : 'OK'),
   aquaPoints: r.isDq ? null : aquaPoints(r.finalMs, r.course ?? sanitizedMeet.course, athletes.find(a => a.key === r.athleteKey)?.gender ?? r.gender, r.distance, r.stroke)
 }));
 return { meet: sanitizedMeet, teams: file.teams.filter(t => teamCode === 'all' || t.code === teamCode), athletes, results, fileName, fileHash: hash ?? null, format: file.format, clubId: clubId ?? null };
}
