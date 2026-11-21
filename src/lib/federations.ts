export interface FederationInfo {
  code: string; // ISO 3 or federation ID
  country: string;
  name: string; // Official name
  shortName: string; // Acronym
  flag: string; // Emoji
  associationLabel: string; // Regional terminology
  associations: string[];
}

export const FEDERATIONS: [FederationInfo, ...FederationInfo[]] = [
  {
    code: "VEN",
    country: "Venezuela",
    name: "Federación Venezolana de Deportes Acuáticos",
    shortName: "FEVEDA",
    flag: "🇻🇪",
    associationLabel: "Asociaciones Estadales (ADA / ASODA)",
    associations: [
      "Miranda (ADAEM)",
      "Lara (ADAEL)",
      "Táchira (ADAET)",
      "Mérida (ASODAME)",
      "Distrito Capital (ASDAC)",
      "Carabobo (ASODENA)",
      "Aragua (ASODEA)",
      "Zulia (AZUDA)",
      "Bolívar (ADEABOL)",
      "Anzoátegui (ASOEDA)",
      "Nueva Esparta (ASODAN)",
      "Trujillo (ASODAT)",
      "Sucre (ASODAS)",
      "Yaracuy (ASODAYA)",
      "Portuguesa (ASODAP)",
      "Falcón (ASODAF)",
      "Monagas (ASODAMON)",
      "Guárico (ASODAG)",
      "Barinas (ASOBAR)",
      "Cojedes (ASODAC)",
    ],
  },
  {
    code: "COL",
    country: "Colombia",
    name: "Federación Colombiana de Natación",
    shortName: "FECNA",
    flag: "🇨🇴",
    associationLabel: "Ligas Departamentales",
    associations: [
      "Antioquia (Liga de Natación de Antioquia)",
      "Bogotá (Liga de Natación de Bogotá)",
      "Valle del Cauca (Liga de Natación del Valle)",
      "Santander (Liga Santandereana de Natación)",
      "Bolívar (Liga de Natación de Bolívar)",
      "Atlántico (Liga de Natación del Atlántico)",
      "Risaralda (Liga Risaraldense de Natación)",
      "Caldas (Liga Caldense de Natación)",
      "Tolima (Liga de Natación del Tolima)",
      "Boyacá (Liga de Natación de Boyacá)",
      "Cundinamarca (Liga de Cundinamarca)",
      "Norte de Santander (Liga de Norte de Santander)",
      "Meta (Liga de Natación del Meta)",
      "Quindío (Liga de Natación del Quindío)",
      "Magdalena (Liga de Natación del Magdalena)",
      "Huila (Liga de Natación del Huila)",
    ],
  },
  {
    code: "ESP",
    country: "España",
    name: "Real Federación Española de Natación",
    shortName: "RFEN",
    flag: "🇪🇸",
    associationLabel: "Federaciones Autonómicas",
    associations: [
      "Andalucía (FAN)",
      "Cataluña (FCN)",
      "Madrid (FMN)",
      "Comunidad Valenciana (FNCV)",
      "Galicia (FEGAN)",
      "País Vasco (FVN/EIF)",
      "Castilla y León (FENACYL)",
      "Canarias (FCN)",
      "Baleares (FBN)",
      "Asturias (FDNA)",
      "Aragón (FAN)",
      "Región de Murcia (FNRM)",
      "Castilla-La Mancha (FNCLM)",
      "Cantabria (FCN)",
      "Navarra (FNN)",
      "Extremadura (FEXN)",
      "La Rioja (FRN)",
    ],
  },
  {
    code: "MEX",
    country: "México",
    name: "Federación Mexicana de Natación",
    shortName: "FMN",
    flag: "🇲🇽",
    associationLabel: "Asociaciones Estatales de Natación",
    associations: [
      "Estado de México (ANEM)",
      "Ciudad de México (ANADF)",
      "Jalisco (AJN)",
      "Nuevo León (ANNL)",
      "Baja California (ANBC)",
      "Guanajuato (ANG)",
      "Veracruz (ANV)",
      "Puebla (ANP)",
      "Querétaro (ANQ)",
      "Yucatán (ANY)",
      "Coahuila (ANC)",
      "Chihuahua (ANCh)",
      "Quintana Roo (ANQR)",
      "Sonora (ANS)",
      "Aguascalientes (ANA)",
      "Sinaloa (ANSIN)",
      "San Luis Potosí (ANSLP)",
    ],
  },
  {
    code: "USA",
    country: "Estados Unidos",
    name: "USA Swimming",
    shortName: "USA Swimming",
    flag: "🇺🇸",
    associationLabel: "Local Swimming Committees (LSCs)",
    associations: [
      "Florida Swimming (FL)",
      "Florida Gold Coast (FG)",
      "Southern California (CA)",
      "Pacific Swimming (PC)",
      "North Texas (NT)",
      "Gulf Swimming (GU)",
      "South Texas (ST)",
      "New Jersey (NJ)",
      "Metropolitan (MR)",
      "Illinois (IL)",
      "Ohio (OH)",
      "Virginia (VA)",
      "Georgia (GA)",
      "North Carolina (NC)",
      "Colorado (CO)",
      "Arizona (AZ)",
      "Indiana (IN)",
      "Michigan (MI)",
      "Maryland (MD)",
    ],
  },
  {
    code: "ARG",
    country: "Argentina",
    name: "Confederación Argentina de Deportes Acuáticos",
    shortName: "CADDA",
    flag: "🇦🇷",
    associationLabel: "Federaciones Regionales",
    associations: [
      "Buenos Aires Norte (FENADO)",
      "Ciudad de Buenos Aires (FENABA)",
      "Córdoba (Federación Cordobesa de Natación)",
      "Santa Fe (FESANA)",
      "Entre Ríos (Federación Entrerriana de Natación)",
      "Rosario (Federación Rosario de Natación)",
      "Mendoza (FEMEDA)",
      "Mar del Plata (FMN)",
      "Patagonia (FECHUNAT)",
    ],
  },
  {
    code: "CHL",
    country: "Chile",
    name: "Federación Chilena de Deportes Acuáticos",
    shortName: "FECHIDA",
    flag: "🇨🇱",
    associationLabel: "Asociaciones Regionales",
    associations: [
      "Región Metropolitana (Asociación Santiago)",
      "Valparaíso (Asociación Quinta Región)",
      "Biobío (Asociación Concepción)",
      "Antofagasta (Asociación Norte)",
      "Los Lagos (Asociación Sur)",
      "Coquimbo (Asociación Cuarta Región)",
      "Maule (Asociación Talca)",
    ],
  },
  {
    code: "PER",
    country: "Perú",
    name: "Federación Deportiva Peruana de Natación",
    shortName: "FDPN",
    flag: "🇵🇪",
    associationLabel: "Ligas y Asociaciones Regionales",
    associations: [
      "Lima (Asociación de Clubes de Lima)",
      "Arequipa (Liga de Natación de Arequipa)",
      "La Libertad (Liga de Natación de Trujillo)",
      "Piura (Liga de Natación de Piura)",
      "Cusco (Liga de Natación del Cusco)",
      "Ica (Liga de Natación de Ica)",
    ],
  },
  {
    code: "ECU",
    country: "Ecuador",
    name: "Federación Ecuatoriana de Natación",
    shortName: "FENA",
    flag: "🇪🇨",
    associationLabel: "Asociaciones Provinciales",
    associations: [
      "Pichincha (Concentración Deportiva de Pichincha)",
      "Guayas (Fedeguayas)",
      "Azuay (Federación Deportiva del Azuay)",
      "Manabí (Federación Deportiva de Manabí)",
      "El Oro (Federación Deportiva de El Oro)",
      "Tungurahua (Federación Deportiva de Tungurahua)",
    ],
  },
  {
    code: "OTHER",
    country: "Internacional",
    name: "World Aquatics / Otra Federación",
    shortName: "Internacional",
    flag: "🌐",
    associationLabel: "Asociaciones / Ligas / Zonas",
    associations: [
      "Asociación Regional Norte",
      "Asociación Regional Sur",
      "Asociación Regional Este",
      "Asociación Regional Oeste",
      "Asociación Central",
      "Liga Metropolitana",
    ],
  },
];

/**
 * Preloaded catalog of known competitive swimming clubs organized by federation and association.
 * Allows instant auto-classification of clubs for FEVEDA and other national federations.
 */
export interface KnownClubCatalogItem {
  code: string;
  name: string;
  association: string;
  federationCode: string;
}

export const KNOWN_FEDERATION_CLUBS: KnownClubCatalogItem[] = [
  // Venezuela (FEVEDA) - Lara (ADAEL)
  { code: "PIS", name: "Piscinas Bolivarianas", association: "Lara (ADAEL)", federationCode: "VEN" },
  { code: "PBOL", name: "Piscinas Bolivarianas de Lara", association: "Lara (ADAEL)", federationCode: "VEN" },
  { code: "HISP", name: "Hogar Hispano de Lara", association: "Lara (ADAEL)", federationCode: "VEN" },
  { code: "CBL", name: "Club Barquisimeto", association: "Lara (ADAEL)", federationCode: "VEN" },
  { code: "CDL", name: "Club Deportivo Lara", association: "Lara (ADAEL)", federationCode: "VEN" },
  { code: "AQU", name: "Aqua Lara", association: "Lara (ADAEL)", federationCode: "VEN" },
  { code: "TRIL", name: "Triatlón y Natación Lara", association: "Lara (ADAEL)", federationCode: "VEN" },
  { code: "ADAL", name: "Selección Lara (ADAEL)", association: "Lara (ADAEL)", federationCode: "VEN" },
  { code: "CSL", name: "Centro Social Larense", association: "Lara (ADAEL)", federationCode: "VEN" },
  { code: "CVM", name: "Club Victoria Morita Cabudare", association: "Lara (ADAEL)", federationCode: "VEN" },
  { code: "PALM", name: "Las Palmas Carora", association: "Lara (ADAEL)", federationCode: "VEN" },
  { code: "TAR", name: "Tarzanes de Lara", association: "Lara (ADAEL)", federationCode: "VEN" },

  // Venezuela (FEVEDA) - Miranda (ADAEM)
  { code: "CPMI", name: "Centro Portugués del Estado Miranda", association: "Miranda (ADAEM)", federationCode: "VEN" },
  { code: "EMIL", name: "Emil Friedman", association: "Miranda (ADAEM)", federationCode: "VEN" },
  { code: "CIVM", name: "Centro Ítalo Venezolano Miranda", association: "Miranda (ADAEM)", federationCode: "VEN" },
  { code: "SCLN", name: "Sport Center Los Naranjos", association: "Miranda (ADAEM)", federationCode: "VEN" },
  { code: "SAL", name: "Club Los Salias", association: "Miranda (ADAEM)", federationCode: "VEN" },
  { code: "HUM", name: "Humboldt Miranda", association: "Miranda (ADAEM)", federationCode: "VEN" },
  { code: "STPO", name: "Santa Paula", association: "Miranda (ADAEM)", federationCode: "VEN" },
  { code: "CLAR", name: "Club La Lagunita", association: "Miranda (ADAEM)", federationCode: "VEN" },
  { code: "VMA", name: "Valle Arriba Athletic Club", association: "Miranda (ADAEM)", federationCode: "VEN" },

  // Venezuela (FEVEDA) - Distrito Capital (ASDAC)
  { code: "CIV", name: "Centro Ítalo Venezolano Caracas", association: "Distrito Capital (ASDAC)", federationCode: "VEN" },
  { code: "PNU", name: "Parque Naciones Unidas", association: "Distrito Capital (ASDAC)", federationCode: "VEN" },
  { code: "TEO", name: "Teo Capriles", association: "Distrito Capital (ASDAC)", federationCode: "VEN" },
  { code: "YMCA", name: "YMCA Caracas", association: "Distrito Capital (ASDAC)", federationCode: "VEN" },
  { code: "UCV", name: "Universidad Central de Venezuela", association: "Distrito Capital (ASDAC)", federationCode: "VEN" },
  { code: "HEB", name: "Hebraica Caracas", association: "Distrito Capital (ASDAC)", federationCode: "VEN" },
  { code: "HGC", name: "Hermandad Gallega de Caracas", association: "Distrito Capital (ASDAC)", federationCode: "VEN" },

  // Venezuela (FEVEDA) - Carabobo (ASODENA)
  { code: "HGV", name: "Hermandad Gallega de Valencia", association: "Carabobo (ASODENA)", federationCode: "VEN" },
  { code: "CSIV", name: "Centro Social Ítalo Venezolano Valencia", association: "Carabobo (ASODENA)", federationCode: "VEN" },
  { code: "HHV", name: "Hogar Hispano de Valencia", association: "Carabobo (ASODENA)", federationCode: "VEN" },
  { code: "CVP", name: "Club Valles de Camoruco", association: "Carabobo (ASODENA)", federationCode: "VEN" },

  // Venezuela (FEVEDA) - Aragua (ASODEA)
  { code: "CPA", name: "Casa Portuguesa de Aragua", association: "Aragua (ASODEA)", federationCode: "VEN" },
  { code: "HHA", name: "Hogar Hispano de Aragua", association: "Aragua (ASODEA)", federationCode: "VEN" },
  { code: "CSIA", name: "Centro Social Ítalo de Aragua", association: "Aragua (ASODEA)", federationCode: "VEN" },

  // Venezuela (FEVEDA) - Táchira (ADAET)
  { code: "DSC", name: "Demócrata Sport Club", association: "Táchira (ADAET)", federationCode: "VEN" },
  { code: "CSC", name: "Club San Cristóbal", association: "Táchira (ADAET)", federationCode: "VEN" },

  // Venezuela (FEVEDA) - Mérida (ASODAME)
  { code: "MER", name: "Club Natación Mérida", association: "Mérida (ASODAME)", federationCode: "VEN" },
  { code: "HUMM", name: "Humboldt Mérida", association: "Mérida (ASODAME)", federationCode: "VEN" },

  // Venezuela (FEVEDA) - Zulia (AZUDA)
  { code: "MDZ", name: "Maracaibo Deporte Zulia", association: "Zulia (AZUDA)", federationCode: "VEN" },
  { code: "CPZ", name: "Casa D'Italia Maracaibo", association: "Zulia (AZUDA)", federationCode: "VEN" },
  { code: "CSZ", name: "Club San Francisco Zulia", association: "Zulia (AZUDA)", federationCode: "VEN" },
  { code: "CRZ", name: "Club Rafael Urdaneta", association: "Zulia (AZUDA)", federationCode: "VEN" },

  // Venezuela (FEVEDA) - Bolívar (ADEABOL)
  { code: "CIB", name: "Centro Ítalo Venezolano de Guayana", association: "Bolívar (ADEABOL)", federationCode: "VEN" },
  { code: "CVG", name: "CVG Ferrominera", association: "Bolívar (ADEABOL)", federationCode: "VEN" },
  { code: "AQUB", name: "Aquática Bolívar", association: "Bolívar (ADEABOL)", federationCode: "VEN" },
  { code: "PBO", name: "Piscinas Puerto Ordaz", association: "Bolívar (ADEABOL)", federationCode: "VEN" },

  // Venezuela (FEVEDA) - Anzoátegui (ASOEDA)
  { code: "CNA", name: "Club Natación Anzoátegui", association: "Anzoátegui (ASOEDA)", federationCode: "VEN" },
  { code: "CIA", name: "Centro Ítalo de Oriente", association: "Anzoátegui (ASOEDA)", federationCode: "VEN" },
  { code: "PEL", name: "Los Pelaos de Puerto La Cruz", association: "Anzoátegui (ASOEDA)", federationCode: "VEN" },
  { code: "MORR", name: "Morro Swimming Club", association: "Anzoátegui (ASOEDA)", federationCode: "VEN" },

  // Venezuela (FEVEDA) - Nueva Esparta (ASODAN)
  { code: "MGA", name: "Club Margarita Aquatics", association: "Nueva Esparta (ASODAN)", federationCode: "VEN" },
  { code: "PPM", name: "Playa El Ángel Pampatar", association: "Nueva Esparta (ASODAN)", federationCode: "VEN" },

  // Venezuela (FEVEDA) - Trujillo (ASODAT)
  { code: "TRU", name: "Club Valera Trujillo", association: "Trujillo (ASODAT)", federationCode: "VEN" },

  // Venezuela (FEVEDA) - Falcón (ASODAF)
  { code: "CORO", name: "Club Coro Falcón", association: "Falcón (ASODAF)", federationCode: "VEN" },
  { code: "PFI", name: "Punto Fijo Swimming", association: "Falcón (ASODAF)", federationCode: "VEN" },

  // Venezuela (FEVEDA) - Yaracuy (ASODAYA)
  { code: "SAN", name: "San Felipe Aquatics", association: "Yaracuy (ASODAYA)", federationCode: "VEN" },

  // Venezuela (FEVEDA) - Portuguesa (ASODAP)
  { code: "ACAR", name: "Acarigua Swimming Club", association: "Portuguesa (ASODAP)", federationCode: "VEN" },
  { code: "GUA", name: "Guanare Natación", association: "Portuguesa (ASODAP)", federationCode: "VEN" },

  // Colombia (FECNA)
  { code: "ANT", name: "Club Huracanes Antioquia", association: "Antioquia (Liga de Natación de Antioquia)", federationCode: "COL" },
  { code: "CAL", name: "Club Calamares Antioquia", association: "Antioquia (Liga de Natación de Antioquia)", federationCode: "COL" },
  { code: "BOG", name: "Club Compensar Bogotá", association: "Bogotá (Liga de Natación de Bogotá)", federationCode: "COL" },
  { code: "ALB", name: "Club Albatros Bogotá", association: "Bogotá (Liga de Natación de Bogotá)", federationCode: "COL" },
  { code: "VAL", name: "Club Astros del Valle", association: "Valle del Cauca (Liga de Natación del Valle)", federationCode: "COL" },
  { code: "CRU", name: "Club Críspulo Quintana", association: "Valle del Cauca (Liga de Natación del Valle)", federationCode: "COL" },
  { code: "SAN", name: "Club Poseidón Santander", association: "Santander (Liga Santandereana de Natación)", federationCode: "COL" },
  { code: "ATL", name: "Tiburones de Barranquilla", association: "Atlántico (Liga de Natación del Atlántico)", federationCode: "COL" },

  // España (RFEN)
  { code: "SAB", name: "Club Natació Sabadell", association: "Cataluña (FCN)", federationCode: "ESP" },
  { code: "TER", name: "Club Natació Terrassa", association: "Cataluña (FCN)", federationCode: "ESP" },
  { code: "SANT", name: "Club Natació Sant Andreu", association: "Cataluña (FCN)", federationCode: "ESP" },
  { code: "CANO", name: "Real Canoe N.C.", association: "Madrid (FMN)", federationCode: "ESP" },
  { code: "GRED", name: "C.D. Gredos San Diego", association: "Madrid (FMN)", federationCode: "ESP" },
  { code: "SEV", name: "Club Natación Sevilla", association: "Andalucía (FAN)", federationCode: "ESP" },
  { code: "MAI", name: "Club Natación Mairena del Aljarafe", association: "Andalucía (FAN)", federationCode: "ESP" },
  { code: "VAL", name: "C.N. Ferca-San José", association: "Comunidad Valenciana (FNCV)", federationCode: "ESP" },

  // México (FMN)
  { code: "ANEM", name: "Acuática Nelson Vargas EdoMex", association: "Estado de México (ANEM)", federationCode: "MEX" },
  { code: "CDMX", name: "Acuática Nelson Vargas CDMX", association: "Ciudad de México (ADDF)", federationCode: "MEX" },
  { code: "JAL", name: "Club Atlas Colomos", association: "Jalisco (AJN)", federationCode: "MEX" },
  { code: "NL", name: "Tigres UANL", association: "Nuevo León (ANL)", federationCode: "MEX" },

  // USA Swimming
  { code: "AZFL", name: "Azura Florida Aquatics", association: "Florida Gold Coast (FG)", federationCode: "USA" },
  { code: "PST", name: "Pine Crest Swimming", association: "Florida Gold Coast (FG)", federationCode: "USA" },
  { code: "SOFL", name: "South Florida Aquatic Club", association: "Florida Gold Coast (FG)", federationCode: "USA" },
  { code: "NOVA", name: "Irvine Novaquatics", association: "Southern California (CA)", federationCode: "USA" },
  { code: "MVN", name: "Mission Viejo Nadadores", association: "Southern California (CA)", federationCode: "USA" },
];

/**
 * Finds known official association for a club by code or name within a federation.
 */
export function findKnownClubAssociation(
  code: string,
  name?: string,
  federationCode: string = "VEN"
): string | null {
  const cleanCode = (code || "").toUpperCase().trim();
  const cleanName = (name || "").toUpperCase().trim();

  const match = KNOWN_FEDERATION_CLUBS.find((c) => {
    if (federationCode && c.federationCode !== federationCode) return false;
    if (c.code.toUpperCase() === cleanCode) return true;
    if (cleanName && cleanName.length > 3 && c.name.toUpperCase().includes(cleanName)) return true;
    return false;
  });

  return match ? match.association : null;
}

/**
 * Returns the federation by ISO code or country name. Defaults to FEVEDA (VEN) if not found.
 */
export function getFederation(codeOrCountry: string = "VEN"): FederationInfo {
  const query = codeOrCountry.trim().toUpperCase();
  const match = FEDERATIONS.find(
    (f) =>
      f.code.toUpperCase() === query ||
      f.shortName.toUpperCase() === query ||
      f.country.toUpperCase() === query
  );
  return match || FEDERATIONS[0];
}

/**
 * Returns all associations for a given country or federation.
 */
export function getAssociationsForFederation(codeOrCountry: string = "VEN"): string[] {
  return getFederation(codeOrCountry).associations;
}

/**
 * Returns all preloaded affiliated clubs for a given federation.
 */
export function getKnownClubsForFederation(federationCode: string = "VEN"): KnownClubCatalogItem[] {
  const fed = getFederation(federationCode);
  return KNOWN_FEDERATION_CLUBS.filter(
    (c) => c.federationCode.toUpperCase() === fed.code.toUpperCase()
  );
}

/**
 * Bulk loads / upserts all official affiliated clubs of the selected federation into Supabase teams.
 * Ensures the clubs exist in the system and are linked to their respective regional associations.
 */
export async function loadFederationAffiliatedClubs(
  supabaseClient: any,
  ownerId: string,
  federationCode: string
): Promise<{ count: number; federation: FederationInfo; clubs: KnownClubCatalogItem[] }> {
  const fed = getFederation(federationCode);
  const clubs = getKnownClubsForFederation(fed.code);

  if (clubs.length === 0) {
    return { count: 0, federation: fed, clubs: [] };
  }

  const records = clubs.map((c) => ({
    owner_id: ownerId,
    code: c.code,
    name: c.name,
    lsc: c.association,
  }));

  const { error } = await supabaseClient
    .from("teams")
    .upsert(records, { onConflict: "owner_id,code" });

  if (error) throw error;

  return { count: clubs.length, federation: fed, clubs };
}
