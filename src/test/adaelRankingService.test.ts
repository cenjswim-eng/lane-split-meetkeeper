import { describe, it, expect } from 'vitest';
import {
  getAdaelRanking2026,
  classifyFederatedCategory,
  matchesCategoryFilter,
  calculateAge,
  type RawSwimRecord,
  type AdaelRankingFilters,
} from '@/services/adaelRanking';

describe('Servicio getAdaelRanking2026 · Lógica de Negocio Agente 2', () => {
  const sampleData: RawSwimRecord[] = [
    // Nadador 1: Iker Peña (PISBO - Lara). 3 participaciones en 100m Libre LCM
    {
      resultId: 'res_1a',
      swimmerId: 'swim_iker',
      swimmerName: 'Peña, Iker',
      gender: 'M',
      birthDate: '2012-05-15', // Edad al 31/12/2026: 14 años (Juvenil A)
      clubCode: 'PISBO',
      clubName: 'Club Piscinas Bolivarianas',
      associationCode: 'LARA',
      meetName: 'Campeonato Estadal Apertura ADAEL 2026',
      meetDate: '2026-03-20', // Edad al meet: 13 años (Infantil B)
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      timeMs: 56200,
      status: 'OK',
      isExhibition: false,
    },
    {
      resultId: 'res_1b',
      swimmerId: 'swim_iker',
      swimmerName: 'Peña, Iker',
      gender: 'M',
      birthDate: '2012-05-15',
      clubCode: 'PISBO',
      clubName: 'Club Piscinas Bolivarianas',
      associationCode: 'LARA',
      meetName: 'Campeonato Nacional Abierto FEVEDA 2026 (Caracas)', // Torneo Nacional fuera de Lara
      meetDate: '2026-07-10',
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      timeMs: 54800, // MEJOR MARCA DEL AÑO DE IKER
      status: 'OK',
      isExhibition: false,
    },
    {
      resultId: 'res_1c',
      swimmerId: 'swim_iker',
      swimmerName: 'Peña, Iker',
      gender: 'M',
      birthDate: '2012-05-15',
      clubCode: 'PISBO',
      clubName: 'Club Piscinas Bolivarianas',
      associationCode: 'LARA',
      meetName: 'Copa Aniversario Hogar Hispano 2026',
      meetDate: '2026-10-15',
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      timeMs: 55500,
      status: 'OK',
      isExhibition: false,
    },

    // Nadador 2: Carlos Rodríguez (HISP - Lara). Empate con Iker en 54.80
    {
      resultId: 'res_2',
      swimmerId: 'swim_carlos',
      swimmerName: 'Rodríguez, Carlos',
      gender: 'M',
      birthDate: '2012-03-10', // Edad al 31/12/2026: 14 años (Juvenil A)
      clubCode: 'HISP',
      clubName: 'Club Hogar Hispano de Lara',
      associationCode: 'LARA',
      meetName: 'Campeonato Estadal Apertura ADAEL 2026',
      meetDate: '2026-03-20',
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      timeMs: 54800, // Empate con Iker
      status: 'OK',
      isExhibition: false,
    },

    // Nadador 3: Miguel Sánchez (BARQ - Lara). 55.90
    {
      resultId: 'res_3',
      swimmerId: 'swim_miguel',
      swimmerName: 'Sánchez, Miguel',
      gender: 'M',
      birthDate: '2012-11-20', // Edad al 31/12/2026: 14 años (Juvenil A)
      clubCode: 'BARQ',
      clubName: 'Club Barquisimeto',
      associationCode: 'LARA',
      meetName: 'Campeonato Estadal Apertura ADAEL 2026',
      meetDate: '2026-03-20',
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      timeMs: 55900,
      status: 'OK',
      isExhibition: false,
    },

    // Nadador 4: Luis Mendoza (SCLN - Miranda). Nadó en Barquisimeto pero NO es de ADAEL
    {
      resultId: 'res_4',
      swimmerId: 'swim_luis_miranda',
      swimmerName: 'Mendoza, Luis',
      gender: 'M',
      birthDate: '2012-04-10',
      clubCode: 'SCLN', // Sport Center Los Naranjos (Miranda)
      clubName: 'Sport Center Los Naranjos',
      associationCode: 'MIR',
      meetName: 'Campeonato Estadal Apertura ADAEL 2026 (Invitado)',
      meetDate: '2026-03-20',
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      timeMs: 53900, // Más rápido pero NO es de un club afiliado a ADAEL
      status: 'OK',
      isExhibition: false,
    },

    // Nadador 5: Gabriel Hernández (PISBO - Lara). Nadó como Exhibición (EXH)
    {
      resultId: 'res_5',
      swimmerId: 'swim_gabriel_exh',
      swimmerName: 'Hernández, Gabriel',
      gender: 'M',
      birthDate: '2012-01-15',
      clubCode: 'PISBO',
      clubName: 'Club Piscinas Bolivarianas',
      associationCode: 'LARA',
      meetName: 'Campeonato Estadal Apertura ADAEL 2026',
      meetDate: '2026-03-20',
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      timeMs: 54100,
      status: 'OK',
      isExhibition: true, // Exhibición
    },

    // Nadador 6: Daniel Descalificado (PISBO - Lara). Descalificado (DQ)
    {
      resultId: 'res_6',
      swimmerId: 'swim_daniel_dq',
      swimmerName: 'Torres, Daniel',
      gender: 'M',
      birthDate: '2012-06-25',
      clubCode: 'PISBO',
      clubName: 'Club Piscinas Bolivarianas',
      associationCode: 'LARA',
      meetName: 'Campeonato Estadal Apertura ADAEL 2026',
      meetDate: '2026-03-20',
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      timeMs: 53000,
      status: 'DQ', // Descalificado
      isExhibition: false,
    },

    // Nadador 7: Juan Para-Nadador (HISP - Lara). Clase funcional S9
    {
      resultId: 'res_7',
      swimmerId: 'swim_para_juan',
      swimmerName: 'Colmenárez, Juan',
      gender: 'M',
      birthDate: '2008-09-12', // 18 años
      clubCode: 'HISP',
      clubName: 'Club Hogar Hispano de Lara',
      associationCode: 'LARA',
      meetName: 'Torneo Abierto Inclusivo ADAEL 2026',
      meetDate: '2026-06-18',
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      timeMs: 101200, // 1:01.20
      status: 'OK',
      isExhibition: false,
      paraClass: 'S9',
    },

    // Nadador 8: Andrés Infantil B (ACUAR - Lara). 12 años
    {
      resultId: 'res_8',
      swimmerId: 'swim_andres_inf_b',
      swimmerName: 'Morales, Andrés',
      gender: 'M',
      birthDate: '2014-04-18', // Edad al 31/12/2026: 12 años (Infantil B)
      clubCode: 'ACUAR',
      clubName: 'Club Acuáticos de Lara',
      associationCode: 'LARA',
      meetName: 'Festival Estadal ADAEL 2026',
      meetDate: '2026-05-15',
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      timeMs: 104500,
      status: 'OK',
      isExhibition: false,
    },

    // Nadador 9: Diego Infantil A (TRIL - Lara). 10 años
    {
      resultId: 'res_9',
      swimmerId: 'swim_diego_inf_a',
      swimmerName: 'Castillo, Diego',
      gender: 'M',
      birthDate: '2016-02-10', // Edad al 31/12/2026: 10 años (Infantil A)
      clubCode: 'TRIL',
      clubName: 'Club Triatlón Lara',
      associationCode: 'LARA',
      meetName: 'Festival Semillero ADAEL 2026',
      meetDate: '2026-04-12',
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      timeMs: 112400,
      status: 'OK',
      isExhibition: false,
    },
  ];

  it('Regla 1: filtra únicamente resultados válidos (OK) y excluye exhibiciones salvo activación explícita', async () => {
    const filters: AdaelRankingFilters = {
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      gender: 'M',
      includeExhibition: false,
    };

    const ranking = await getAdaelRanking2026(filters, sampleData);

    // Debe excluir a Daniel (DQ) y a Gabriel (EXH)
    const swimmerNames = ranking.map((r) => r.swimmerName);
    expect(swimmerNames).not.toContain('Torres, Daniel');
    expect(swimmerNames).not.toContain('Hernández, Gabriel');

    // Con includeExhibition: true, Gabriel sí debe entrar
    const rankingWithExh = await getAdaelRanking2026(
      { ...filters, includeExhibition: true },
      sampleData
    );
    const namesWithExh = rankingWithExh.map((r) => r.swimmerName);
    expect(namesWithExh).toContain('Hernández, Gabriel');
  });

  it('Regla 2: incluye nadadores de adael_clubs en Nacionales fuera de Lara y excluye atletas de otros estados', async () => {
    const filters: AdaelRankingFilters = {
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      gender: 'M',
    };

    const ranking = await getAdaelRanking2026(filters, sampleData);

    // Iker compitió en el Nacional Abierto en Caracas con PISBO (Lara) => Debe estar incluido
    const iker = ranking.find((r) => r.swimmerId === 'swim_iker');
    expect(iker).toBeDefined();
    expect(iker?.meetName).toContain('Nacional Abierto FEVEDA');

    // Luis Mendoza (SCLN - Miranda) NO pertenece a ningún club de ADAEL => Debe estar excluido
    const luis = ranking.find((r) => r.swimmerId === 'swim_luis_miranda');
    expect(luis).toBeUndefined();
  });

  it('Regla 3: deduplica por swimmerId conservando la mejor marca del año 2026 y maneja empates con salto', async () => {
    const filters: AdaelRankingFilters = {
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      gender: 'M',
    };

    const ranking = await getAdaelRanking2026(filters, sampleData);

    // Iker tenía 3 marcas (56.20, 54.80, 55.50). Solo debe aparecer 1 sola vez con 54.80 (54800 ms)
    const ikerRecords = ranking.filter((r) => r.swimmerId === 'swim_iker');
    expect(ikerRecords.length).toBe(1);
    expect(ikerRecords[0]?.timeMs).toBe(54800);
    expect(ikerRecords[0]?.formattedTime).toBe('54.80');

    // Iker y Carlos Rodríguez empataron en el puesto 1 con 54.80
    expect(ranking[0]?.rank).toBe(1);
    expect(ranking[0]?.timeMs).toBe(54800);
    expect(ranking[1]?.rank).toBe(1);
    expect(ranking[1]?.timeMs).toBe(54800);

    // Salto de ranking oficial: el siguiente nadador (Miguel Sánchez, 55.90) debe ser puesto 3 (no puesto 2)
    const miguel = ranking.find((r) => r.swimmerId === 'swim_miguel');
    expect(miguel?.rank).toBe(3);
    expect(miguel?.timeMs).toBe(55900);
  });

  it('Regla 4: calcula la edad al 31/12/2026 por defecto y permite cambiar a edad al día del torneo', async () => {
    // Iker nació el 15/05/2012.
    // Al 31/12/2026: tiene 14 años (Juvenil A).
    // Al 20/03/2026 (meetDate Apertura): tenía 13 años (Infantil B).
    const rankingDec31 = await getAdaelRanking2026(
      { distance: 100, stroke: 'FREE', course: 'LCM', gender: 'M', ageMode: 'DEC_31' },
      sampleData
    );
    const ikerDec31 = rankingDec31.find((r) => r.swimmerId === 'swim_iker');
    expect(ikerDec31?.age).toBe(14);
    expect(ikerDec31?.categoryLabel).toBe('Juvenil A (14-15 años)');

    const rankingMeetDate = await getAdaelRanking2026(
      { distance: 100, stroke: 'FREE', course: 'LCM', gender: 'M', ageMode: 'MEET_DATE' },
      sampleData
    );
    const ikerMeetDate = rankingMeetDate.find((r) => r.swimmerId === 'swim_iker');
    // En su mejor marca (Caracas 10/07/2026, posterior a su cumpleaños 15/05) ya tiene 14
    expect(ikerMeetDate?.age).toBe(14);

    // Probar con fecha de meet anterior a cumpleaños
    expect(calculateAge('2012-05-15', '2026-03-20')).toBe(13);
    expect(calculateAge('2012-05-15', '2026-12-31')).toBe(14);
  });

  it('Regla 5: clasifica correctamente en los bloques federativos (Infantil A/B, Juvenil A/B, Máxima)', async () => {
    // Bloques federativos
    expect(classifyFederatedCategory(8)).toBe('Pre-Infantil (≤9 años)');
    expect(classifyFederatedCategory(10)).toBe('Infantil A (10-11 años)');
    expect(classifyFederatedCategory(11)).toBe('Infantil A (10-11 años)');
    expect(classifyFederatedCategory(12)).toBe('Infantil B (12-13 años)');
    expect(classifyFederatedCategory(13)).toBe('Infantil B (12-13 años)');
    expect(classifyFederatedCategory(14)).toBe('Juvenil A (14-15 años)');
    expect(classifyFederatedCategory(15)).toBe('Juvenil A (14-15 años)');
    expect(classifyFederatedCategory(16)).toBe('Juvenil B (16-18 años)');
    expect(classifyFederatedCategory(18)).toBe('Juvenil B (16-18 años)');
    expect(classifyFederatedCategory(19)).toBe('Máxima (19 y más años)');

    // Filtro Infantil A (10-11 años): solo Diego (10 años)
    const rankingInfA = await getAdaelRanking2026(
      { distance: 100, stroke: 'FREE', course: 'LCM', gender: 'M', category: 'INFANTIL_A' },
      sampleData
    );
    expect(rankingInfA.length).toBe(1);
    expect(rankingInfA[0]?.swimmerName).toBe('Castillo, Diego');

    // Filtro Infantil B (12-13 años): solo Andrés (12 años)
    const rankingInfB = await getAdaelRanking2026(
      { distance: 100, stroke: 'FREE', course: 'LCM', gender: 'M', category: 'INFANTIL_B' },
      sampleData
    );
    expect(rankingInfB.length).toBe(1);
    expect(rankingInfB[0]?.swimmerName).toBe('Morales, Andrés');

    // Filtro Juvenil A (14-15 años): Iker (14), Carlos (14), Miguel (14)
    const rankingJuvA = await getAdaelRanking2026(
      { distance: 100, stroke: 'FREE', course: 'LCM', gender: 'M', category: 'JUVENIL_A' },
      sampleData
    );
    expect(rankingJuvA.length).toBe(3);
  });

  it('Regla 5 (Continuación): clasifica y filtra por edad única (9 a 18+) y clases de Para-Natación', async () => {
    // Filtro edad única: exactamente 10 años
    const ranking10 = await getAdaelRanking2026(
      { distance: 100, stroke: 'FREE', course: 'LCM', gender: 'M', category: 'SINGLE_AGE', singleAge: 10 },
      sampleData
    );
    expect(ranking10.length).toBe(1);
    expect(ranking10[0]?.age).toBe(10);
    expect(ranking10[0]?.singleAgeLabel).toBe('10 años');

    // Filtro edad única: exactamente 14 años
    const ranking14 = await getAdaelRanking2026(
      { distance: 100, stroke: 'FREE', course: 'LCM', gender: 'M', category: 'SINGLE_AGE', singleAge: 14 },
      sampleData
    );
    expect(ranking14.length).toBe(3);
    expect(ranking14.every((r) => r.age === 14)).toBe(true);

    // Filtro Para-Natación (clase S9)
    const rankingPara = await getAdaelRanking2026(
      { distance: 100, stroke: 'FREE', course: 'LCM', gender: 'M', category: 'PARA_SWIMMING', paraClass: 'S9' },
      sampleData
    );
    expect(rankingPara.length).toBe(1);
    expect(rankingPara[0]?.swimmerName).toBe('Colmenárez, Juan');
    expect(rankingPara[0]?.paraClass).toBe('S9');
    expect(rankingPara[0]?.categoryLabel).toContain('Para-Natación (S9)');
  });
});
