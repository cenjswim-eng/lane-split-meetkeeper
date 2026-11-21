export interface FederationInfo {
  code: string; // ISO 3 or federation ID
  country: string;
  name: string; // Official name
  shortName: string; // Acronym
  flag: string; // Emoji
  associationLabel: string; // Regional terminology
  associations: string[];
}

export const FEDERATIONS: FederationInfo[] = [
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
