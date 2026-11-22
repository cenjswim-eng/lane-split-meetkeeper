import { describe, it, expect } from 'vitest';
import {
  adaptToSwimResults,
  generateStateRanking,
  calculateStateRankingSummary,
  cleanStateName,
} from '@/lib/state-ranking';
import { normalizeTeamCode, FEVEDA_MASTER_CLUBS } from '@/data/fevedaClubs';
import { KNOWN_ADAEL_CODES } from '@/lib/team-hub/ranking-engine';

describe('Resolución de Clubes Rivales y Ranking Estadal', () => {
  it('1. cleanStateName normaliza ADAEL a lara y ADAEM a miranda', () => {
    expect(cleanStateName('Lara')).toBe('lara');
    expect(cleanStateName('Lara (ADAEL)')).toBe('lara');
    expect(cleanStateName('ADAEL')).toBe('lara');
    expect(cleanStateName('Miranda')).toBe('miranda');
    expect(cleanStateName('ADAEM')).toBe('miranda');
  });

  it('2. KNOWN_ADAEL_CODES incluye todos los clubes oficiales de Lara', () => {
    expect(KNOWN_ADAEL_CODES).toContain('JSWIM');
    expect(KNOWN_ADAEL_CODES).toContain('PIBOL');
    expect(KNOWN_ADAEL_CODES).toContain('HOCAL');
    expect(KNOWN_ADAEL_CODES).toContain('LUSOL');
    expect(KNOWN_ADAEL_CODES).toContain('GATLA');
    expect(KNOWN_ADAEL_CODES).toContain('BARQ');
  });

  it('3. adaptToSwimResults atribuye clubes rivales sin sobreescribir con el club del usuario', () => {
    const athleteRivalHocal = {
      id: 'ath-rival-1',
      first_name: 'Mateo',
      last_name: 'Pérez',
      birth_date: '2011-03-10',
      gender: 'M',
      club_id: 'my-club-account-uuid', // El club_id en Supabase apunta a la cuenta del coach
      clubs: { id: 'my-club-account-uuid', team_code: 'JSWIM', full_name: 'Club J-Swim Lara' },
      team_id: 'team-hocal-uuid',      // Pero su equipo asignado en la competencia es HOCAL
      teams: { id: 'team-hocal-uuid', code: 'HOCAL', name: 'Hogar Canario Larense', lsc: 'ADAEL' },
    };

    const athleteRivalPibol = {
      id: 'ath-rival-2',
      first_name: 'Diego',
      last_name: 'Colmenárez',
      birth_date: '2011-06-15',
      gender: 'M',
      club_id: 'my-club-account-uuid',
      clubs: { id: 'my-club-account-uuid', team_code: 'JSWIM', full_name: 'Club J-Swim Lara' },
      team_id: 'team-pibol-uuid',      // Su equipo en Meet Manager es PIBO (truncado a 4 letras)
      teams: { id: 'team-pibol-uuid', code: 'PIBO', name: 'Piscinas Bolivarianas', lsc: 'ADAEL' },
    };

    const athleteMyClub = {
      id: 'ath-myclub-1',
      first_name: 'Samuel',
      last_name: 'Gómez',
      birth_date: '2011-05-20',
      gender: 'M',
      club_id: 'my-club-account-uuid',
      clubs: { id: 'my-club-account-uuid', team_code: 'JSWIM', full_name: 'Club J-Swim Lara' },
      team_id: 'team-jswim-uuid',
      teams: { id: 'team-jswim-uuid', code: 'JSWIM', name: 'Club J-Swim Lara', lsc: 'ADAEL' },
    };

    const athleteRivalWithoutTeamsJoin = {
      id: 'ath-rival-3',
      first_name: 'Andrés',
      last_name: 'Silva',
      birth_date: '2011-07-08',
      gender: 'M',
      club_id: 'my-club-account-uuid',
      clubs: { id: 'my-club-account-uuid', team_code: 'JSWIM', full_name: 'Club J-Swim Lara' },
      team_id: 'team-lusol-uuid',      // teams join no cargado, solo team_id presente
    };

    const mockResults = [
      {
        id: 'res-1',
        athlete_id: 'ath-rival-1',
        final_time_ms: 54000, // 54.00s (Líder Rival - HOCAL)
        distance: 100,
        stroke: 1,
        course: 'LCM',
        meets: { name: 'Campeonato Estadal 2026', start_date: '2026-03-20' },
      },
      {
        id: 'res-2',
        athlete_id: 'ath-myclub-1',
        final_time_ms: 55000, // 55.00s (2do lugar - Mi Club JSWIM)
        distance: 100,
        stroke: 1,
        course: 'LCM',
        meets: { name: 'Campeonato Estadal 2026', start_date: '2026-03-20' },
      },
      {
        id: 'res-3',
        athlete_id: 'ath-rival-2',
        final_time_ms: 56500, // 56.50s (3er lugar Rival - PIBOL normalizado desde PIBO)
        distance: 100,
        stroke: 1,
        course: 'LCM',
        meets: { name: 'Campeonato Estadal 2026', start_date: '2026-03-20' },
      },
      {
        id: 'res-4',
        athlete_id: 'ath-rival-3',
        final_time_ms: 57200, // 57.20s (4to lugar Rival - LUSOL resuelto por team_id lookup)
        distance: 100,
        stroke: 1,
        course: 'LCM',
        meets: { name: 'Campeonato Estadal 2026', start_date: '2026-03-20' },
      },
    ];

    const mockClubs = [
      { id: 'my-club-account-uuid', team_code: 'JSWIM', full_name: 'Club J-Swim Lara', region_lsc: 'Lara' },
    ];

    const mockTeams = [
      { id: 'team-hocal-uuid', code: 'HOCAL', name: 'Hogar Canario Larense', lsc: 'ADAEL' },
      { id: 'team-pibol-uuid', code: 'PIBO', name: 'Piscinas Bolivarianas de Lara', lsc: 'ADAEL' },
      { id: 'team-jswim-uuid', code: 'JSWIM', name: 'Club J-Swim Lara', lsc: 'ADAEL' },
      { id: 'team-lusol-uuid', code: 'LUSOL', name: 'Club Lusitano Lu Sol', lsc: 'ADAEL' },
    ];

    const adaptedResults = adaptToSwimResults(mockResults, [
      athleteRivalHocal,
      athleteRivalPibol,
      athleteMyClub,
      athleteRivalWithoutTeamsJoin,
    ], mockClubs, mockTeams);

    expect(adaptedResults).toHaveLength(4);

    const hocalRes = adaptedResults.find((r) => r.athleteId === 'ath-rival-1');
    const pibolRes = adaptedResults.find((r) => r.athleteId === 'ath-rival-2');
    const jswimRes = adaptedResults.find((r) => r.athleteId === 'ath-myclub-1');
    const lusolRes = adaptedResults.find((r) => r.athleteId === 'ath-rival-3');

    expect(hocalRes?.clubCode).toBe('HOCAL');
    expect(pibolRes?.clubCode).toBe('PIBOL');
    expect(jswimRes?.clubCode).toBe('JSWIM');
    expect(lusolRes?.clubCode).toBe('LUSOL');
  });

  it('4. adaptToSwimResults soporta registros de la tabla official_results_2026', () => {
    const mockOfficialResult = [
      {
        id: 'off-1',
        swimmer_name: 'Barquisimeto Nadador',
        birth_date: '2011-04-10',
        gender: 'M',
        club_code: 'BARQ',
        distance: 100,
        stroke: 'FREE',
        course: 'LCM',
        time_ms: 58000,
        status: 'OK',
        wa_points: 520,
        round: 'F',
        meets_2026: { name: 'I Invitacional ADAEL 2026', start_date: '2026-02-15' },
        adael_clubs: { name: 'Club Barquisimeto', association: 'Lara' },
      },
    ];

    const adapted = adaptToSwimResults(mockOfficialResult, []);
    expect(adapted).toHaveLength(1);
    expect(adapted[0].clubCode).toBe('BARQ');
    expect(adapted[0].state).toBe('Lara');
  });

  it('5. generateStateRanking genera ranking con rivales y diferencias exactas vs líder y vs mi club', () => {
    const athleteRivalHocal = {
      id: 'ath-rival-1',
      first_name: 'Mateo',
      last_name: 'Pérez',
      birth_date: '2011-03-10',
      gender: 'M',
      club_id: 'my-club-account-uuid',
      team_id: 'team-hocal-uuid',
      teams: { id: 'team-hocal-uuid', code: 'HOCAL', name: 'Hogar Canario Larense', lsc: 'ADAEL' },
    };

    const athleteMyClub = {
      id: 'ath-myclub-1',
      first_name: 'Samuel',
      last_name: 'Gómez',
      birth_date: '2011-05-20',
      gender: 'M',
      club_id: 'my-club-account-uuid',
      team_id: 'team-jswim-uuid',
      teams: { id: 'team-jswim-uuid', code: 'JSWIM', name: 'Club J-Swim Lara', lsc: 'ADAEL' },
    };

    const mockResults = [
      {
        id: 'res-1',
        athlete_id: 'ath-rival-1',
        final_time_ms: 54000,
        distance: 100,
        stroke: 1,
        course: 'LCM',
        meets: { name: 'Torneo', start_date: '2026-03-20' },
      },
      {
        id: 'res-2',
        athlete_id: 'ath-myclub-1',
        final_time_ms: 55000,
        distance: 100,
        stroke: 1,
        course: 'LCM',
        meets: { name: 'Torneo', start_date: '2026-03-20' },
      },
    ];

    const adapted = adaptToSwimResults(mockResults, [athleteRivalHocal, athleteMyClub]);
    const ranking = generateStateRanking(adapted, {
      myClubCode: 'JSWIM',
      state: 'Lara',
      gender: 'M',
      eventCode: '100_FREE',
      course: 'LCM',
      minAge: 14,
      maxAge: 15,
      referenceYear: 2026,
    });

    expect(ranking).toHaveLength(2);
    expect(ranking[0].rank).toBe(1);
    expect(ranking[0].clubCode).toBe('HOCAL');
    expect(ranking[0].isMyClub).toBe(false);
    expect(ranking[0].diffFromLeader).toBe('—');
    expect(ranking[0].diffVsMyClub).toBe('-1.00s');

    expect(ranking[1].rank).toBe(2);
    expect(ranking[1].clubCode).toBe('JSWIM');
    expect(ranking[1].isMyClub).toBe(true);
    expect(ranking[1].diffFromLeader).toBe('+1.00s');
    expect(ranking[1].diffVsMyClub).toBe('0.00s');

    const summary = calculateStateRankingSummary(ranking, {
      myClubCode: 'JSWIM',
      state: 'Lara',
      gender: 'M',
      eventCode: '100_FREE',
      course: 'LCM',
      minAge: 14,
      maxAge: 15,
      referenceYear: 2026,
    });

    expect(summary.totalSwimmers).toBe(2);
    expect(summary.myClubTop8Count).toBe(1);
    expect(summary.leader?.clubCode).toBe('HOCAL');
    expect(summary.myClubBest?.clubCode).toBe('JSWIM');
    expect(summary.myClubLeaderGapSeconds).toBe(1.00);
  });
});
