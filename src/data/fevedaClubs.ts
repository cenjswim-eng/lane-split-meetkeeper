/**
 * Directorio Oficial FEVEDA — Asociaciones Estadales y Diccionario Maestro de Clubes
 * Ubicación: src/data/fevedaClubs.ts
 *
 * Fuente canónica para unificar códigos de clubes entre exportaciones Hy-Tek:
 * - .hy3 (5 caracteres en línea C1: ej. JSWIM, LUSOL, HOCAL, PIBOL)
 * - .cl2 / SDIF (truncado a 4 caracteres en C1 y F0: ej. JSWI, LUSO, HOCA, PIBO)
 */

export interface FevedaLSC {
  code: string;        // Ej: 'ADAEL'
  name: string;        // 'Asociación de Deportes Acuáticos del Estado Lara'
  state: string;       // 'Lara'
  shortName: string;   // 'Lara (ADAEL)'
}

export interface FevedaClub {
  code: string;        // Código oficial canónico de 5 caracteres (ej. 'JSWIM')
  name: string;        // Nombre completo oficial
  shortName?: string;  // Nombre corto o común
  lsc: string;         // Código de asociación (ej. 'ADAEL')
  state: string;       // Estado geográfico (ej. 'Lara')
  aliases?: string[];  // Alias y códigos históricos (ej. ['JSWI', 'J SWIM'])
}

export interface NormalizedTeamResult {
  code: string;
  name: string;
  state: string;
  lsc: string;
  isPending?: boolean;
}

/**
 * Directorio Oficial de Asociaciones Estadales de Deportes Acuáticos de Venezuela (LSC / FEVEDA)
 */
export const FEVEDA_LSCS: Record<string, FevedaLSC> = {
  ADAEL: { code: 'ADAEL', name: 'Asociación de Deportes Acuáticos del Estado Lara', state: 'Lara', shortName: 'Lara (ADAEL)' },
  ADAEM: { code: 'ADAEM', name: 'Asociación de Deportes Acuáticos del Estado Miranda', state: 'Miranda', shortName: 'Miranda (ADAEM)' },
  ADADC: { code: 'ADADC', name: 'Asociación de Deportes Acuáticos de Distrito Capital', state: 'Distrito Capital', shortName: 'Distrito Capital (ADADC)' },
  ADAC: { code: 'ADAC', name: 'Asociación de Deportes Acuáticos del Estado Carabobo', state: 'Carabobo', shortName: 'Carabobo (ADAC)' },
  ADABOLIVAR: { code: 'ADABOLIVAR', name: 'Asociación de Deportes Acuáticos del Estado Bolívar', state: 'Bolívar', shortName: 'Bolívar (ADABOLIVAR)' },
  ASODAMER: { code: 'ASODAMER', name: 'Asociación de Deportes Acuáticos del Estado Mérida', state: 'Mérida', shortName: 'Mérida (ASODAMER)' },
  ADAANZ: { code: 'ADAANZ', name: 'Asociación de Deportes Acuáticos del Estado Anzoátegui', state: 'Anzoátegui', shortName: 'Anzoátegui (ADAANZ)' },
  ADAA: { code: 'ADAA', name: 'Asociación de Deportes Acuáticos del Estado Aragua', state: 'Aragua', shortName: 'Aragua (ADAA)' },
  ADAZU: { code: 'ADAZU', name: 'Asociación de Deportes Acuáticos del Estado Zulia', state: 'Zulia', shortName: 'Zulia (ADAZU)' },
  ADAY: { code: 'ADAY', name: 'Asociación de Deportes Acuáticos del Estado Yaracuy', state: 'Yaracuy', shortName: 'Yaracuy (ADAY)' },
  ADAPOR: { code: 'ADAPOR', name: 'Asociación de Deportes Acuáticos del Estado Portuguesa', state: 'Portuguesa', shortName: 'Portuguesa (ADAPOR)' },
  ADAFA: { code: 'ADAFA', name: 'Asociación de Deportes Acuáticos del Estado Falcón', state: 'Falcón', shortName: 'Falcón (ADAFA)' },
  ADAT: { code: 'ADAT', name: 'Asociación de Deportes Acuáticos del Estado Táchira', state: 'Táchira', shortName: 'Táchira (ADAT)' },
  ASODASU: { code: 'ASODASU', name: 'Asociación de Deportes Acuáticos del Estado Sucre', state: 'Sucre', shortName: 'Sucre (ASODASU)' },
  ASOTRU: { code: 'ASOTRU', name: 'Asociación de Deportes Acuáticos del Estado Trujillo', state: 'Trujillo', shortName: 'Trujillo (ASOTRU)' },
  ADABAR: { code: 'ADABAR', name: 'Asociación de Deportes Acuáticos del Estado Barinas', state: 'Barinas', shortName: 'Barinas (ADABAR)' },
  ADACAR: { code: 'ADACAR', name: 'Asociación de Deportes Acuáticos del Estado Cojedes', state: 'Cojedes', shortName: 'Cojedes (ADACAR)' },
  ADAGUA: { code: 'ADAGUA', name: 'Asociación de Deportes Acuáticos del Estado Guárico', state: 'Guárico', shortName: 'Guárico (ADAGUA)' },
  ADANUE: { code: 'ADANUE', name: 'Asociación de Deportes Acuáticos del Estado Nueva Esparta', state: 'Nueva Esparta', shortName: 'Nueva Esparta (ADANUE)' },
  ADAMON: { code: 'ADAMON', name: 'Asociación de Deportes Acuáticos del Estado Monagas', state: 'Monagas', shortName: 'Monagas (ADAMON)' },
  ADAAP: { code: 'ADAAP', name: 'Asociación de Deportes Acuáticos del Estado Apure', state: 'Apure', shortName: 'Apure (ADAAP)' },
  ADAAMA: { code: 'ADAAMA', name: 'Asociación de Deportes Acuáticos del Estado Amazonas', state: 'Amazonas', shortName: 'Amazonas (ADAAMA)' },
  ADADELTA: { code: 'ADADELTA', name: 'Asociación de Deportes Acuáticos del Estado Delta Amacuro', state: 'Delta Amacuro', shortName: 'Delta Amacuro (ADADELTA)' },
  ADAVAR: { code: 'ADAVAR', name: 'Asociación de Deportes Acuáticos del Estado La Guaira', state: 'La Guaira', shortName: 'La Guaira (ADAVAR)' },
};

/**
 * Diccionario Maestro de Clubes Oficiales Afiliados a FEVEDA
 */
export const FEVEDA_MASTER_CLUBS: Record<string, FevedaClub> = {
  // === ESTADO LARA (ADAEL) ===
  HOCAL: {
    code: 'HOCAL',
    name: 'Hogar Canario Larense',
    shortName: 'Hogar Canario',
    lsc: 'ADAEL',
    state: 'Lara',
    aliases: ['HOCA', 'HHIS', 'HISPANO', 'HIL'],
  },
  PIBOL: {
    code: 'PIBOL',
    name: 'Piscinas Bolivarianas de Lara',
    shortName: 'Piscinas Bolivarianas',
    lsc: 'ADAEL',
    state: 'Lara',
    aliases: ['PIBO', 'PBOL', 'PIS', 'PISBO'],
  },
  LUSOL: {
    code: 'LUSOL',
    name: 'Club Lusitano Lu Sol',
    shortName: 'Lu Sol Lara',
    lsc: 'ADAEL',
    state: 'Lara',
    aliases: ['LUSO', 'LUSITANO'],
  },
  JSWIM: {
    code: 'JSWIM',
    name: 'J Swim Club Lara',
    shortName: 'J Swim',
    lsc: 'ADAEL',
    state: 'Lara',
    aliases: ['JSWI', 'JSW', 'J-SWIM'],
  },
  GATLA: {
    code: 'GATLA',
    name: 'Gatos de Lara',
    shortName: 'Gatos de Lara',
    lsc: 'ADAEL',
    state: 'Lara',
    aliases: ['GATL', 'GATOS'],
  },
  CADIP: {
    code: 'CADIP',
    name: 'Club de Natación CADIP Lara',
    shortName: 'CADIP',
    lsc: 'ADAEL',
    state: 'Lara',
    aliases: ['CADI', 'CADIPL'],
  },
  CNCAR: {
    code: 'CNCAR',
    name: 'Club Natación Carora',
    shortName: 'CN Carora',
    lsc: 'ADAEL',
    state: 'Lara',
    aliases: ['CNCA', 'CARORA'],
  },
  CCTRY: {
    code: 'CCTRY',
    name: 'Barquisimeto Country Club',
    shortName: 'Country Club',
    lsc: 'ADAEL',
    state: 'Lara',
    aliases: ['CCTR', 'CBL', 'BARQ'],
  },
  CAQC: {
    code: 'CAQC',
    name: 'Aquacenter Lara',
    shortName: 'Aquacenter',
    lsc: 'ADAEL',
    state: 'Lara',
    aliases: ['CAQC', 'AQU', 'AQUALARA', 'ACUAR'],
  },
  CIVLA: {
    code: 'CIVLA',
    name: 'Centro Ítalo Venezolano Lara',
    shortName: 'Italo Lara',
    lsc: 'ADAEL',
    state: 'Lara',
    aliases: ['CIVL', 'ITALARA', 'CIVLARA'],
  },
  CAEL: {
    code: 'CAEL',
    name: 'Club América El Tocuyo',
    shortName: 'América El Tocuyo',
    lsc: 'ADAEL',
    state: 'Lara',
    aliases: ['CAEL', 'ELTOCUYO'],
  },
  DELFJ: {
    code: 'DELFJ',
    name: 'Delfines de Javier',
    shortName: 'Delfines de Javier',
    lsc: 'ADAEL',
    state: 'Lara',
    aliases: ['DELF', 'DELFINES'],
  },
  HUNLA: {
    code: 'HUNLA',
    name: 'Club Hunter Lara',
    shortName: 'Hunter Lara',
    lsc: 'ADAEL',
    state: 'Lara',
    aliases: ['HUNL', 'HUNTER'],
  },

  // === CLUBES NACIONALES VERIFICADOS ===
  CIVMI: {
    code: 'CIVMI',
    name: 'Centro Ítalo Venezolano Miranda',
    shortName: 'Ítalo Miranda',
    lsc: 'ADAEM',
    state: 'Miranda',
    aliases: ['CIVM', 'CIVMIR'],
  },
  EMILF: {
    code: 'EMILF',
    name: 'Colegio Emil Friedman',
    shortName: 'Emil Friedman',
    lsc: 'ADAEM',
    state: 'Miranda',
    aliases: ['EMIL', 'EFRIE'],
  },
  CPMIR: {
    code: 'CPMIR',
    name: 'Centro Portugués Miranda',
    shortName: 'Portugués Miranda',
    lsc: 'ADAEM',
    state: 'Miranda',
    aliases: ['CPMI', 'CPORT'],
  },
  SCLN: {
    code: 'SCLN',
    name: 'Sport Center Los Naranjos',
    shortName: 'Los Naranjos',
    lsc: 'ADAEM',
    state: 'Miranda',
    aliases: ['SCLN', 'NARAN'],
  },
  CNCDC: {
    code: 'CNCDC',
    name: 'Centro Natación Caracas',
    shortName: 'Natación Caracas',
    lsc: 'ADADC',
    state: 'Distrito Capital',
    aliases: ['CNCD', 'CARACAS'],
  },
  PNUDC: {
    code: 'PNUDC',
    name: 'Parque Naciones Unidas DC',
    shortName: 'PNU Caracas',
    lsc: 'ADADC',
    state: 'Distrito Capital',
    aliases: ['PNUD', 'PNU'],
  },
  YMCAV: {
    code: 'YMCAV',
    name: 'YMCA Valencia',
    shortName: 'YMCA Valencia',
    lsc: 'ADAC',
    state: 'Carabobo',
    aliases: ['YMCA', 'YMCAVAL'],
  },
  VINA: {
    code: 'VINA',
    name: 'Club Viña del Mar / Centro Social Ítalo',
    shortName: 'Viña del Mar',
    lsc: 'ADAC',
    state: 'Carabobo',
    aliases: ['VINA', 'VINAD'],
  },
  CIVG: {
    code: 'CIVG',
    name: 'Centro Ítalo Venezolano Guayana',
    shortName: 'Ítalo Guayana',
    lsc: 'ADABOLIVAR',
    state: 'Bolívar',
    aliases: ['CIVG', 'CIVGUAY'],
  },
};

/**
 * Tabla directa de resolución de 4 caracteres (Meet Manager .cl2) a 5 caracteres oficiales (.hy3)
 */
export const KNOWN_4_TO_5_CODE_MAP: Record<string, string> = {
  // Lara
  JSWI: 'JSWIM',
  LUSO: 'LUSOL',
  HOCA: 'HOCAL',
  PIBO: 'PIBOL',
  PISB: 'PIBOL',
  PBOL: 'PIBOL',
  GATL: 'GATLA',
  CADI: 'CADIP',
  CNCA: 'CNCAR',
  CCTR: 'CCTRY',
  CAQC: 'CAQC',
  CIVL: 'CIVLA',
  DELF: 'DELFJ',
  HUNL: 'HUNLA',
  CAEL: 'CAEL',
  // Nacionales
  CIVM: 'CIVMI',
  EMIL: 'EMILF',
  CPMI: 'CPMIR',
  SCLN: 'SCLN',
  CNCD: 'CNCDC',
  PNUD: 'PNUDC',
  YMCA: 'YMCAV',
  VINA: 'VINA',
  CIVG: 'CIVG',
};

/**
 * Registro dinámico de clubes detectados fuera del catálogo maestro
 */
const dynamicClubCache = new Map<string, NormalizedTeamResult>();

/**
 * Normaliza y deduce el estado a partir de un nombre o código de LSC
 */
export function resolveStateFromLsc(lscCodeOrState?: string | null): string {
  if (!lscCodeOrState) return 'Lara';
  const clean = lscCodeOrState.toUpperCase().trim();
  if (FEVEDA_LSCS[clean]) return FEVEDA_LSCS[clean].state;
  for (const lsc of Object.values(FEVEDA_LSCS)) {
    if (clean.includes(lsc.code) || clean.includes(lsc.state.toUpperCase())) {
      return lsc.state;
    }
  }
  return lscCodeOrState.trim();
}

/**
 * Normaliza el código de equipo de Hy-Tek unificando códigos truncados de 4 caracteres
 * (.cl2 / SDIF) con su código canónico oficial de 5 caracteres (.hy3).
 */
export function normalizeTeamCode(
  rawCode: string,
  teamName?: string | null,
  defaultState = 'Lara'
): NormalizedTeamResult {
  const cleanCode = (rawCode || '').toUpperCase().trim();
  const cleanName = (teamName || '').toUpperCase().trim();

  if (!cleanCode) {
    return {
      code: 'UNAT',
      name: teamName?.trim() || 'No Afiliado / Unattached',
      state: defaultState,
      lsc: 'UNAT',
      isPending: false,
    };
  }

  // 1. Coincidencia exacta con catálogo maestro de 5 caracteres
  if (FEVEDA_MASTER_CLUBS[cleanCode]) {
    const club = FEVEDA_MASTER_CLUBS[cleanCode];
    return {
      code: club.code,
      name: teamName?.trim() || club.name,
      state: club.state,
      lsc: club.lsc,
      isPending: false,
    };
  }

  // 2. Mapeo directo de 4 letras conocido (.cl2 -> .hy3)
  if (KNOWN_4_TO_5_CODE_MAP[cleanCode]) {
    const targetCode = KNOWN_4_TO_5_CODE_MAP[cleanCode];
    const club = FEVEDA_MASTER_CLUBS[targetCode];
    if (club) {
      return {
        code: club.code,
        name: teamName?.trim() || club.name,
        state: club.state,
        lsc: club.lsc,
        isPending: false,
      };
    }
  }

  // 3. Búsqueda por alias o prefijo de 4 letras en el catálogo maestro
  for (const club of Object.values(FEVEDA_MASTER_CLUBS)) {
    // Coincidencia con alias
    if (club.aliases?.some((a) => a.toUpperCase() === cleanCode)) {
      return {
        code: club.code,
        name: teamName?.trim() || club.name,
        state: club.state,
        lsc: club.lsc,
        isPending: false,
      };
    }

    // Coincidencia por prefijo de 4 letras + similitud en el nombre
    if (cleanCode.length === 4 && club.code.startsWith(cleanCode)) {
      if (!cleanName || cleanName.includes(cleanCode) || cleanName.includes(club.shortName?.toUpperCase() || '')) {
        return {
          code: club.code,
          name: teamName?.trim() || club.name,
          state: club.state,
          lsc: club.lsc,
          isPending: false,
        };
      }
    }
  }

  // 4. Búsqueda por similitud de nombre completo si el código es genérico
  if (cleanName) {
    for (const club of Object.values(FEVEDA_MASTER_CLUBS)) {
      const clubNormName = club.name.toUpperCase();
      const clubShortNorm = (club.shortName || '').toUpperCase();
      if (
        cleanName === clubNormName ||
        (cleanName.length > 5 && clubNormName.includes(cleanName)) ||
        (cleanName.length > 5 && cleanName.includes(clubNormName)) ||
        (clubShortNorm && cleanName.includes(clubShortNorm))
      ) {
        return {
          code: club.code,
          name: teamName?.trim() || club.name,
          state: club.state,
          lsc: club.lsc,
          isPending: false,
        };
      }
    }
  }

  // 5. Club desconocido: registrar dinámicamente como pendiente
  // Asocia automáticamente al estado de la competencia
  const cached = dynamicClubCache.get(cleanCode);
  if (cached) {
    return cached;
  }

  const resolvedState = resolveStateFromLsc(defaultState);
  let resolvedLsc = 'FEVEDA';
  for (const lsc of Object.values(FEVEDA_LSCS)) {
    if (lsc.state.toLowerCase() === resolvedState.toLowerCase()) {
      resolvedLsc = lsc.code;
      break;
    }
  }

  const pendingClub: NormalizedTeamResult = {
    code: cleanCode,
    name: teamName?.trim() || cleanCode,
    state: resolvedState,
    lsc: resolvedLsc,
    isPending: true,
  };

  dynamicClubCache.set(cleanCode, pendingClub);
  return pendingClub;
}

/**
 * Comprueba si un club pertenece a ADAEL (Lara)
 */
export function isAdaelAffiliatedCode(rawCode: string, name?: string | null): boolean {
  const normalized = normalizeTeamCode(rawCode, name);
  return normalized.lsc === 'ADAEL' || normalized.state.toLowerCase() === 'lara';
}
