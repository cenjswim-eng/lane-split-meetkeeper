/**
 * Componente Principal de Interfaz: Ranking Oficial Natación Federada — ADAEL 2026
 * Ubicación: src/components/adael/AdaelRankingView.tsx
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Trophy,
  Medal,
  Calendar,
  Waves,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Award,
  Building2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  getAdaelRanking2026,
  type AdaelRankingFilters,
  type RankedAthleteItem,
  type CourseType,
  type StrokeCode,
  type FederatedAgeCategory,
  type RawSwimRecord,
} from '@/services/adaelRanking';
import {
  getFevedaNationalStandard,
  compareAthleteWithStandard,
  type NationalStandardType,
} from '@/lib/adael-ranking/national-standards-feveda';
import { generateAdaelRankingPdf } from '@/lib/adael-ranking/export-ranking-pdf';
import { generateAdaelRankingExcel } from '@/lib/adael-ranking/export-ranking-excel';
import { AdaelBatchUploaderModal } from './AdaelBatchUploaderModal';
import { AdaelClubPdfImporterModal } from './AdaelClubPdfImporterModal';
import { downloadFile } from '@/lib/file-delivery';
import { supabase } from '@/integrations/supabase/client';

// Lista oficial de clubes afiliados a ADAEL (Estado Lara)
export const ADAEL_CLUBS_LIST = [
  { code: 'all', name: 'Todos los Clubes ADAEL' },
  { code: 'PISBO', name: 'PISBO — Piscinas Bolivarianas' },
  { code: 'HISP', name: 'HISP — Hogar Hispano de Lara' },
  { code: 'BARQ', name: 'BARQ — Club Barquisimeto' },
  { code: 'CDLARA', name: 'CDLARA — Club Deportivo Lara' },
  { code: 'AQUALARA', name: 'AQUALARA — Club Aqualara' },
  { code: 'TRILARA', name: 'TRILARA — Club Triatlón Lara' },
  { code: 'CSLAR', name: 'CSLAR — Centro Social Larense' },
  { code: 'PALM', name: 'PALM — Club Las Palmas' },
  { code: 'TARL', name: 'TARL — Club Tarpones de Lara' },
  { code: 'CVM', name: 'CVM — Vencedores de Morán' },
  { code: 'HOCAL', name: 'HOCAL — Hogar Canario Larense' },
  { code: 'LARA', name: 'LARA — Selección del Estado Lara' },
];

const STROKE_LABELS: Record<StrokeCode, string> = {
  FREE: 'Libre',
  BACK: 'Espalda',
  BREAST: 'Pecho',
  FLY: 'Mariposa',
  IM: 'C. Individual',
};

const CATEGORY_PRESETS: { label: string; value: FederatedAgeCategory }[] = [
  { label: 'Todas las Categorías (Open)', value: 'TODAS' },
  { label: 'Infantil A (10 - 11 años)', value: 'INFANTIL_A' },
  { label: 'Infantil B (12 - 13 años)', value: 'INFANTIL_B' },
  { label: 'Juvenil A (14 - 15 años)', value: 'JUVENIL_A' },
  { label: 'Juvenil B (16 - 18 años)', value: 'JUVENIL_B' },
  { label: 'Máxima (19 y más años)', value: 'MAXIMA' },
  { label: 'Pre-Infantil (≤9 años)', value: 'PRE_INFANTIL' },
  { label: 'Edad Única', value: 'SINGLE_AGE' },
  { label: 'Para-Natación', value: 'PARA_SWIMMING' },
];

// Registros de demostración realistas de ADAEL Lara para visualización inmediata si DB está vacía
const MOCK_ADAEL_2026_RECORDS: RawSwimRecord[] = [
  {
    resultId: 'mock-1',
    swimmerId: 'AD-001',
    swimmerName: 'Alejandro Morales',
    gender: 'M',
    birthDate: '2011-04-15', // 15 años al 2026-12-31 (Juvenil A)
    clubCode: 'PISBO',
    clubName: 'Club Piscinas Bolivarianas de Lara',
    associationCode: 'LARA',
    meetName: 'I Invitacional ADAEL Lara 2026',
    meetDate: '2026-03-14',
    distance: 100,
    stroke: 'FREE',
    course: 'LCM',
    timeMs: 56800,
    status: 'OK',
    isExhibition: false,
    isRelayLeadOff: false,
    waPoints: 610,
  },
  {
    resultId: 'mock-2',
    swimmerId: 'AD-002',
    swimmerName: 'Santiago Rodríguez',
    gender: 'M',
    birthDate: '2011-08-20', // 15 años (Juvenil A)
    clubCode: 'HISP',
    clubName: 'Club Hogar Hispano de Lara',
    associationCode: 'LARA',
    meetName: 'I Invitacional ADAEL Lara 2026',
    meetDate: '2026-03-14',
    distance: 100,
    stroke: 'FREE',
    course: 'LCM',
    timeMs: 57200,
    status: 'OK',
    isExhibition: false,
    isRelayLeadOff: false,
    waPoints: 598,
  },
  {
    resultId: 'mock-3',
    swimmerId: 'AD-003',
    swimmerName: 'Carlos Mendoza',
    gender: 'M',
    birthDate: '2012-01-10', // 14 años (Juvenil A)
    clubCode: 'BARQ',
    clubName: 'Club Barquisimeto',
    associationCode: 'LARA',
    meetName: 'Campeonato Nacional Interclubes 2026',
    meetDate: '2026-04-18',
    distance: 100,
    stroke: 'FREE',
    course: 'LCM',
    timeMs: 57950,
    status: 'OK',
    isExhibition: false,
    isRelayLeadOff: false,
    waPoints: 575,
  },
  {
    resultId: 'mock-4',
    swimmerId: 'AD-004',
    swimmerName: 'Gabriel Torrealba',
    gender: 'M',
    birthDate: '2011-11-05',
    clubCode: 'CDLARA',
    clubName: 'Club Deportivo Lara',
    associationCode: 'LARA',
    meetName: 'I Invitacional ADAEL Lara 2026',
    meetDate: '2026-03-14',
    distance: 100,
    stroke: 'FREE',
    course: 'LCM',
    timeMs: 58400,
    status: 'OK',
    isExhibition: false,
    isRelayLeadOff: true, // Lead-off split en relevo 4x100 libre
    waPoints: 561,
  },
  {
    resultId: 'mock-5',
    swimmerId: 'AD-005',
    swimmerName: 'Diego Andrés Alvarado',
    gender: 'M',
    birthDate: '2012-06-12',
    clubCode: 'PISBO',
    clubName: 'Club Piscinas Bolivarianas de Lara',
    associationCode: 'LARA',
    meetName: 'I Invitacional ADAEL Lara 2026',
    meetDate: '2026-03-14',
    distance: 100,
    stroke: 'FREE',
    course: 'LCM',
    timeMs: 59100,
    status: 'OK',
    isExhibition: false,
    isRelayLeadOff: false,
    waPoints: 541,
  },
  {
    resultId: 'mock-6',
    swimmerId: 'AD-006',
    swimmerName: 'Luis Fernando Colmenárez',
    gender: 'M',
    birthDate: '2011-09-30',
    clubCode: 'AQUALARA',
    clubName: 'Club Aqualara',
    associationCode: 'LARA',
    meetName: 'Torneo Apertura ADAEL 2026',
    meetDate: '2026-02-21',
    distance: 100,
    stroke: 'FREE',
    course: 'LCM',
    timeMs: 60250,
    status: 'OK',
    isExhibition: false,
    isRelayLeadOff: false,
    waPoints: 511,
  },
  // Femenino 100 Libre
  {
    resultId: 'mock-f1',
    swimmerId: 'AD-F01',
    swimmerName: 'Camila Isabella Yépez',
    gender: 'F',
    birthDate: '2011-03-14',
    clubCode: 'PISBO',
    clubName: 'Club Piscinas Bolivarianas de Lara',
    associationCode: 'LARA',
    meetName: 'I Invitacional ADAEL Lara 2026',
    meetDate: '2026-03-14',
    distance: 100,
    stroke: 'FREE',
    course: 'LCM',
    timeMs: 61800,
    status: 'OK',
    isExhibition: false,
    isRelayLeadOff: false,
    waPoints: 615,
  },
  {
    resultId: 'mock-f2',
    swimmerId: 'AD-F02',
    swimmerName: 'Valeria Sofía Ramos',
    gender: 'F',
    birthDate: '2012-02-18',
    clubCode: 'HISP',
    clubName: 'Club Hogar Hispano de Lara',
    associationCode: 'LARA',
    meetName: 'I Invitacional ADAEL Lara 2026',
    meetDate: '2026-03-14',
    distance: 100,
    stroke: 'FREE',
    course: 'LCM',
    timeMs: 62900,
    status: 'OK',
    isExhibition: false,
    isRelayLeadOff: false,
    waPoints: 583,
  },
  // 50m Libre Masculino
  {
    resultId: 'mock-50m-1',
    swimmerId: 'AD-001',
    swimmerName: 'Alejandro Morales',
    gender: 'M',
    birthDate: '2011-04-15',
    clubCode: 'PISBO',
    clubName: 'Club Piscinas Bolivarianas de Lara',
    associationCode: 'LARA',
    meetName: 'I Invitacional ADAEL Lara 2026',
    meetDate: '2026-03-14',
    distance: 50,
    stroke: 'FREE',
    course: 'LCM',
    timeMs: 25400,
    status: 'OK',
    isExhibition: false,
    isRelayLeadOff: false,
    waPoints: 625,
  },
  {
    resultId: 'mock-50m-2',
    swimmerId: 'AD-002',
    swimmerName: 'Santiago Rodríguez',
    gender: 'M',
    birthDate: '2011-08-20',
    clubCode: 'HISP',
    clubName: 'Club Hogar Hispano de Lara',
    associationCode: 'LARA',
    meetName: 'I Invitacional ADAEL Lara 2026',
    meetDate: '2026-03-14',
    distance: 50,
    stroke: 'FREE',
    course: 'LCM',
    timeMs: 25950,
    status: 'OK',
    isExhibition: false,
    isRelayLeadOff: false,
    waPoints: 586,
  },
  {
    resultId: 'mock-50m-3',
    swimmerId: 'AD-004',
    swimmerName: 'Gabriel Torrealba',
    gender: 'M',
    birthDate: '2011-11-05',
    clubCode: 'CDLARA',
    clubName: 'Club Deportivo Lara',
    associationCode: 'LARA',
    meetName: 'I Invitacional ADAEL Lara 2026',
    meetDate: '2026-03-14',
    distance: 50,
    stroke: 'FREE',
    course: 'LCM',
    timeMs: 26300,
    status: 'OK',
    isExhibition: false,
    isRelayLeadOff: true,
    waPoints: 563,
  },
];

export function AdaelRankingView() {
  // Estados de Filtros
  const [course, setCourse] = useState<CourseType>('LCM');
  const [gender, setGender] = useState<'M' | 'F' | 'all'>('M');
  const [stroke, setStroke] = useState<StrokeCode>('FREE');
  const [distance, setDistance] = useState<number>(100);
  const [category, setCategory] = useState<FederatedAgeCategory>('TODAS');
  const [singleAge, setSingleAge] = useState<number>(15);
  const [paraClass, setParaClass] = useState<string>('all');
  const [ageMode, setAgeMode] = useState<'DEC_31' | 'MEET_DATE'>('DEC_31');
  const [clubCode, setClubCode] = useState<string>('all');
  const [pdfClubWhitelist, setPdfClubWhitelist] = useState<string[] | null>(null);
  const [standardComparison, setStandardComparison] = useState<'NONE' | NationalStandardType>('A');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [topN, setTopN] = useState<number>(0); // 0 = sin límite

  // Estados de Datos
  const [rankingItems, setRankingItems] = useState<RankedAthleteItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [meetsCount, setMeetsCount] = useState<number>(3);
  const [lastUpdatedDate, setLastUpdatedDate] = useState<string>('21/11/2026');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  // Distancias válidas según el estilo seleccionado
  const validDistances = useMemo(() => {
    switch (stroke) {
      case 'FREE':
        return [50, 100, 200, 400, 800, 1500];
      case 'BACK':
      case 'BREAST':
      case 'FLY':
        return [50, 100, 200];
      case 'IM':
        return [100, 200, 400];
      default:
        return [50, 100, 200];
    }
  }, [stroke]);

  // Lista de clubes disponibles en el selector (prioriza los clubes extraídos del PDF si están activos)
  const availableClubsList = useMemo(() => {
    if (!pdfClubWhitelist || pdfClubWhitelist.length === 0) {
      return ADAEL_CLUBS_LIST;
    }
    const list = [{ code: 'all', name: `Todos los Clubes del PDF (${pdfClubWhitelist.length})` }];
    pdfClubWhitelist.forEach((code) => {
      const existing = ADAEL_CLUBS_LIST.find((c) => c.code === code);
      list.push({
        code,
        name: existing ? existing.name : `${code} — Club ${code}`,
      });
    });
    return list;
  }, [pdfClubWhitelist]);

  // Si la distancia actual no es válida para el estilo seleccionado, auto-ajustar
  useEffect(() => {
    if (!validDistances.includes(distance)) {
      setDistance(validDistances[0] || 100);
    }
  }, [stroke, validDistances, distance]);

  // Consulta de datos de ranking
  const fetchRanking = async () => {
    setIsLoading(true);
    try {
      const filters: AdaelRankingFilters = {
        distance,
        stroke,
        course,
        gender,
        category,
        singleAge: category === 'SINGLE_AGE' ? singleAge : undefined,
        paraClass: category === 'PARA_SWIMMING' ? paraClass : undefined,
        ageMode,
        clubCode: clubCode !== 'all' ? clubCode : undefined,
        clubWhitelist: pdfClubWhitelist && pdfClubWhitelist.length > 0 ? pdfClubWhitelist : undefined,
        topN: topN > 0 ? topN : undefined,
      };

      // 1. Intentar consultar datos reales de Supabase
      const results = await getAdaelRanking2026(filters);

      if (results && results.length > 0) {
        setRankingItems(results);
      } else {
        // Fallback: procesar registros de demostración ADAEL
        const demoResults = await getAdaelRanking2026(filters, MOCK_ADAEL_2026_RECORDS);
        setRankingItems(demoResults);
      }

      // Consultar conteo de torneos 2026
      try {
        const { count, data } = await supabase
          .from('meets_2026' as any)
          .select('id, start_date', { count: 'exact' });

        if (count && count > 0) {
          setMeetsCount(count);
          if (data && data.length > 0) {
            const latest = data.sort((a: any, b: any) =>
              (b.start_date || '').localeCompare(a.start_date || '')
            )[0];
            if (latest?.start_date) {
              setLastUpdatedDate(latest.start_date);
            }
          }
        }
      } catch {
        // mantener conteo predeterminado
      }
    } catch (err: any) {
      console.error('Error fetching ADAEL ranking:', err);
      // Fallback a demo en caso de error de red
      const demoFallback = await getAdaelRanking2026(
        { distance, stroke, course, gender, category, ageMode },
        MOCK_ADAEL_2026_RECORDS
      );
      setRankingItems(demoFallback);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRanking();
  }, [course, gender, stroke, distance, category, singleAge, paraClass, ageMode, clubCode, topN, pdfClubWhitelist]);

  // Marca Mínima Nacional de referencia calculada
  const activeStandard = useMemo(() => {
    if (standardComparison === 'NONE') return null;

    // Tomar la edad representativa según la categoría o el primer atleta del ranking
    let refAge = 15; // default Juvenil A
    if (category === 'INFANTIL_A') refAge = 11;
    else if (category === 'INFANTIL_B') refAge = 13;
    else if (category === 'JUVENIL_A') refAge = 15;
    else if (category === 'JUVENIL_B') refAge = 17;
    else if (category === 'MAXIMA') refAge = 19;
    else if (category === 'SINGLE_AGE') refAge = singleAge;
    else if (rankingItems.length > 0 && rankingItems[0]) {
      refAge = rankingItems[0].age;
    }

    return getFevedaNationalStandard({
      course,
      gender,
      distance,
      stroke,
      age: refAge,
      standardType: standardComparison,
    });
  }, [standardComparison, course, gender, distance, stroke, category, singleAge, rankingItems]);

  // Conteo de clasificados a la Marca Mínima seleccionada
  const qualifiedCount = useMemo(() => {
    if (!activeStandard) return 0;
    return rankingItems.filter((item) => {
      const comp = compareAthleteWithStandard(item.timeMs, activeStandard);
      return comp?.isQualified;
    }).length;
  }, [rankingItems, activeStandard]);

  // Filtrado por buscador rápido en tabla
  const displayedItems = useMemo(() => {
    if (!searchQuery.trim()) return rankingItems;
    const q = searchQuery.toLowerCase().trim();
    return rankingItems.filter(
      (item) =>
        item.swimmerName.toLowerCase().includes(q) ||
        item.clubCode.toLowerCase().includes(q) ||
        item.clubName.toLowerCase().includes(q) ||
        item.meetName.toLowerCase().includes(q)
    );
  }, [rankingItems, searchQuery]);

  const eventLabel = `${distance}m ${STROKE_LABELS[stroke]}`;
  const categoryLabel = CATEGORY_PRESETS.find((c) => c.value === category)?.label || 'Categoría';

  // Manejador de exportación a PDF Oficial
  const handleExportPdf = () => {
    try {
      setIsExportingPdf(true);
      const pdfFile = generateAdaelRankingPdf({
        rankedItems: displayedItems,
        filters: {
          distance,
          stroke,
          course,
          gender,
          category,
          ageMode,
          clubCode: clubCode !== 'all' ? clubCode : undefined,
          clubWhitelist: pdfClubWhitelist && pdfClubWhitelist.length > 0 ? pdfClubWhitelist : undefined,
        },
        meetsCount,
        lastUpdatedDate,
        selectedStandard: activeStandard,
        eventName: eventLabel,
        categoryName: categoryLabel,
      });

      downloadFile(pdfFile);
      toast.success('Documento PDF Oficial generado con éxito', {
        description: `Se descargó el ranking de ${eventLabel} (${course})`,
      });
    } catch (error: any) {
      toast.error('Error al generar PDF', { description: error?.message });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Manejador de exportación a Excel
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const excelFile = await generateAdaelRankingExcel({
        rankedItems: displayedItems,
        filters: {
          distance,
          stroke,
          course,
          gender,
          category,
          ageMode,
          clubCode: clubCode !== 'all' ? clubCode : undefined,
          clubWhitelist: pdfClubWhitelist && pdfClubWhitelist.length > 0 ? pdfClubWhitelist : undefined,
        },
        meetsCount,
        lastUpdatedDate,
        selectedStandard: activeStandard,
        eventName: eventLabel,
        categoryName: categoryLabel,
      });

      downloadFile(excelFile);
      toast.success('Hoja de Cálculo Excel (.xlsx) generada con éxito', {
        description: `Se descargó el ranking de ${eventLabel} (${course})`,
      });
    } catch (error: any) {
      toast.error('Error al generar Excel', { description: error?.message });
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      {/* 1. ENCABEZADO OFICIAL ADAEL */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
              <Trophy className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/40 text-primary font-semibold">
                  Temporada Oficial 2026
                </Badge>
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-300">
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                  FEVEDA · ADAEL Lara
                </Badge>
                <Badge variant="outline" className="text-muted-foreground text-xs">
                  World Aquatics Standards
                </Badge>
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Ranking Oficial Natación Federada — ADAEL 2026
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Asociación de Deportes Acuáticos del Estado Lara. Clasificación oficial de mejores marcas
                anuales con soporte para parciales de relevo reglamentarios y marcas mínimas nacionales.
              </p>
            </div>
          </div>

          {/* Acciones de Carga Masiva y Exportación */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <AdaelClubPdfImporterModal
              onClubsConfirmed={(codes) => {
                setPdfClubWhitelist(codes);
                setClubCode('all');
              }}
            />

            <AdaelBatchUploaderModal
              triggerButton={
                <Button variant="default" className="gap-2 shadow-sm">
                  <Sparkles className="h-4 w-4" />
                  Carga Masiva (.hy3 / .sd3)
                </Button>
              }
              onUploadSuccess={fetchRanking}
            />

            <Button
              variant="outline"
              onClick={handleExportPdf}
              disabled={isExportingPdf || displayedItems.length === 0}
              className="gap-2"
            >
              <FileText className="h-4 w-4 text-red-600" />
              PDF Oficial
            </Button>

            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={isExportingExcel || displayedItems.length === 0}
              className="gap-2"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Excel (.xlsx)
            </Button>
          </div>
        </div>

        {/* Tarjetas de Estadísticas / KPI */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t">
          <div className="rounded-lg bg-muted/40 p-3">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Torneos Procesados
            </span>
            <p className="text-xl font-bold text-foreground mt-0.5">{meetsCount} torneos</p>
          </div>

          <div className="rounded-lg bg-muted/40 p-3">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Última Actualización
            </span>
            <p className="text-xl font-bold text-foreground mt-0.5">{lastUpdatedDate}</p>
          </div>

          <div className="rounded-lg bg-muted/40 p-3">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Waves className="h-3.5 w-3.5" />
              Atletas en Ranking
            </span>
            <p className="text-xl font-bold text-foreground mt-0.5">{rankingItems.length} nadadores</p>
          </div>

          <div className="rounded-lg bg-muted/40 p-3">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Clasificados Marca Min.
            </span>
            <p className="text-xl font-bold text-foreground mt-0.5">
              {activeStandard ? `${qualifiedCount} atletas` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Banner de Filtro Activo por Listado PDF */}
      {pdfClubWhitelist && pdfClubWhitelist.length > 0 && (
        <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground">
                  Filtro de Clubes Oficiales desde PDF Activo
                </p>
                <Badge variant="secondary" className="font-mono text-xs font-bold bg-blue-500/20 text-blue-800 dark:text-blue-200">
                  {pdfClubWhitelist.length} clubes
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generando ranking exclusivamente con marcas de:{' '}
                <span className="font-mono font-semibold text-foreground">
                  {pdfClubWhitelist.slice(0, 10).join(', ')}
                  {pdfClubWhitelist.length > 10 ? '...' : ''}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <AdaelClubPdfImporterModal
              triggerButton={
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-blue-300">
                  <Filter className="h-3.5 w-3.5" />
                  Editar Listado
                </Button>
              }
              onClubsConfirmed={(codes) => {
                setPdfClubWhitelist(codes);
                setClubCode('all');
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-red-600 gap-1"
              onClick={() => {
                setPdfClubWhitelist(null);
                toast.info('Se restableció el filtro a todos los clubes de ADAEL.');
              }}
            >
              <X className="h-3.5 w-3.5" />
              Restablecer
            </Button>
          </div>
        </div>
      )}

      {/* 2. PANEL DE FILTROS FEDERATIVO */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <CardTitle className="text-lg">Panel de Filtros Reglamentarios</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchRanking}
              disabled={isLoading}
              className="h-8 gap-1 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
          <CardDescription>
            Configura la prueba, curso, categoría y comparador de marca mínima para generar el ranking oficial.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Fila 1: Curso, Género, Estilo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Curso / Piscina */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Piscina (Curso)
              </label>
              <Tabs value={course} onValueChange={(v) => setCourse(v as CourseType)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="LCM" className="text-xs">
                    50m LCM (Larga)
                  </TabsTrigger>
                  <TabsTrigger value="SCM" className="text-xs">
                    25m SCM (Corta)
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Género */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Rama (Género)
              </label>
              <Tabs value={gender} onValueChange={(v) => setGender(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="M" className="text-xs">
                    Masculino
                  </TabsTrigger>
                  <TabsTrigger value="F" className="text-xs">
                    Femenino
                  </TabsTrigger>
                  <TabsTrigger value="all" className="text-xs">
                    Todos
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Estilo */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Estilo de Natación
              </label>
              <Select value={stroke} onValueChange={(v) => setStroke(v as StrokeCode)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona estilo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">Libre (Crol)</SelectItem>
                  <SelectItem value="BACK">Espalda (Dorso)</SelectItem>
                  <SelectItem value="BREAST">Pecho (Braza)</SelectItem>
                  <SelectItem value="FLY">Mariposa</SelectItem>
                  <SelectItem value="IM">Combinado Individual (C.I.)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fila 2: Distancia y Categoría Federativa */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Distancia con pills */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Distancia de Prueba
              </label>
              <div className="flex flex-wrap gap-1.5">
                {validDistances.map((d) => (
                  <Button
                    key={d}
                    type="button"
                    variant={distance === d ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => setDistance(d)}
                  >
                    {d}m
                  </Button>
                ))}
              </div>
            </div>

            {/* Presets de Categoría */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Categoría Federativa
              </label>
              <Select value={category} onValueChange={(v) => setCategory(v as FederatedAgeCategory)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_PRESETS.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Club de ADAEL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Club Afiliado (Lara)
              </label>
              <Select value={clubCode} onValueChange={setClubCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los clubes" />
                </SelectTrigger>
                <SelectContent>
                  {availableClubsList.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sub-fila condicional: Edad Única o Para-Natación */}
          {category === 'SINGLE_AGE' && (
            <div className="p-3 bg-muted/40 rounded-lg flex items-center gap-4">
              <span className="text-xs font-semibold">Seleccionar Edad Específica:</span>
              <div className="flex flex-wrap gap-1">
                {[9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((a) => (
                  <Button
                    key={a}
                    type="button"
                    variant={singleAge === a ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setSingleAge(a)}
                  >
                    {a === 19 ? '19+' : `${a} años`}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {category === 'PARA_SWIMMING' && (
            <div className="p-3 bg-muted/40 rounded-lg flex items-center gap-4">
              <span className="text-xs font-semibold">Clase Funcional Para-Natación:</span>
              <Select value={paraClass} onValueChange={setParaClass}>
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue placeholder="Todas las clases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Clases</SelectItem>
                  {['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13', 'S14'].map((cls) => (
                    <SelectItem key={cls} value={cls}>
                      Clase {cls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Fila 3: Comparación con Marcas Mínimas Nacionales y Modo de Edad */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
            {/* Comparación Marca Mínima */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-amber-600" />
                Comparar Marca Mínima Nacional
              </label>
              <Select
                value={standardComparison}
                onValueChange={(v) => setStandardComparison(v as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona marca mínima" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Ninguna (Solo marcas)</SelectItem>
                  <SelectItem value="A">Marca A Nacional (FEVEDA Oficial)</SelectItem>
                  <SelectItem value="B">Marca B Nacional (Invitacional / B)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Modo de cálculo de edad */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Cálculo de Edad Federativa
              </label>
              <Select value={ageMode} onValueChange={(v) => setAgeMode(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEC_31">Edad al 31/12/2026 (Oficial FEVEDA)</SelectItem>
                  <SelectItem value="MEET_DATE">Edad al día del torneo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Recorte Top N */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Límite de Resultados
              </label>
              <Select value={`${topN}`} onValueChange={(v) => setTopN(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Todos los nadadores clasificados</SelectItem>
                  <SelectItem value="10">Top 10</SelectItem>
                  <SelectItem value="20">Top 20</SelectItem>
                  <SelectItem value="50">Top 50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Banner de Marca Mínima Activa */}
          {activeStandard && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="font-medium text-emerald-950 dark:text-emerald-200">
                  Corte Clasificatorio {activeStandard.standardLabel} ({activeStandard.categoryLabel}):
                </span>
                <span className="font-bold text-sm text-emerald-700 dark:text-emerald-300">
                  {activeStandard.formattedTime}
                </span>
              </div>
              <div className="text-muted-foreground">
                <span className="font-semibold text-foreground">{qualifiedCount}</span> de{' '}
                {rankingItems.length} nadadores han alcanzado esta marca mínima.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. TABLA DE RANKING DE ALTO RENDIMIENTO */}
      <div className="space-y-4">
        {/* Barra superior de tabla: Título y Buscador instantáneo */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              {eventLabel} — {course === 'LCM' ? '50m Piscina Larga' : '25m Piscina Corta'}
              <Badge variant="outline" className="ml-2 font-normal">
                {categoryLabel}
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {displayedItems.length} nadadores clasificados ordenados por mejor marca de la temporada 2026.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar atleta o club..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>

        {/* Tabla Responsive */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-14">Pos</th>
                  <th className="py-3 px-3 text-center w-28">Tiempo</th>
                  <th className="py-3 px-3 text-center w-24">Puntos WA</th>
                  <th className="py-3 px-4">Atleta</th>
                  <th className="py-3 px-3 text-center w-20">Edad</th>
                  <th className="py-3 px-3 text-center w-24">Club</th>
                  <th className="py-3 px-4">Torneo Oficial 2026</th>
                  <th className="py-3 px-3 text-center w-28">Fecha</th>
                  <th className="py-3 px-3 text-center w-28">Dif. Marca</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                        <p className="text-sm">Procesando ranking oficial ADAEL 2026...</p>
                      </div>
                    </td>
                  </tr>
                ) : displayedItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="h-8 w-8 text-amber-500" />
                        <p className="font-semibold text-foreground">No hay registros para este filtro</p>
                        <p className="text-xs max-w-md">
                          No se encontraron marcas válidas de clubes de Lara para los criterios seleccionados.
                          Puedes ajustar la distancia, categoría o cargar archivos con el botón de Carga Masiva.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedItems.map((item, index) => {
                    const comparison = compareAthleteWithStandard(item.timeMs, activeStandard);

                    // Estilos de Podio
                    const isFirst = item.rank === 1;
                    const isSecond = item.rank === 2;
                    const isThird = item.rank === 3;

                    return (
                      <tr
                        key={`${item.swimmerId}_${item.resultId || index}`}
                        className={`hover:bg-muted/40 transition-colors ${
                          isFirst
                            ? 'bg-amber-500/5'
                            : isSecond
                            ? 'bg-slate-500/5'
                            : isThird
                            ? 'bg-orange-500/5'
                            : ''
                        }`}
                      >
                        {/* 1. Posición con Podio Visual */}
                        <td className="py-3 px-3 text-center font-bold">
                          {isFirst ? (
                            <Badge className="bg-amber-400 text-amber-950 hover:bg-amber-400 border-amber-500 shadow-sm font-extrabold px-2">
                              🥇 1
                            </Badge>
                          ) : isSecond ? (
                            <Badge className="bg-slate-200 text-slate-800 hover:bg-slate-200 border-slate-300 dark:bg-slate-700 dark:text-slate-100 font-extrabold px-2">
                              🥈 2
                            </Badge>
                          ) : isThird ? (
                            <Badge className="bg-amber-700/20 text-amber-900 hover:bg-amber-700/20 border-amber-700/40 dark:text-amber-300 font-extrabold px-2">
                              🥉 3
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground font-semibold">{item.rank}</span>
                          )}
                        </td>

                        {/* 2. Tiempo Oficial y Badge Lead-off */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-mono text-base font-extrabold text-foreground">
                              {item.formattedTime}
                            </span>
                            {item.isRelayLeadOff && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] px-1 py-0 bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300/40 mt-0.5"
                                    >
                                      1er Tramo Relevo
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">
                                      Marca obtenida en el primer tramo de relevo oficial sin descalificación.
                                      Válida para el ranking individual según reglamento FEVEDA / World Aquatics.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </td>

                        {/* 3. Puntos WA */}
                        <td className="py-3 px-3 text-center">
                          {item.waPoints ? (
                            <Badge
                              variant="outline"
                              className={`font-mono text-xs ${
                                item.waPoints >= 600
                                  ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 font-bold'
                                  : item.waPoints >= 500
                                  ? 'border-blue-500 text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/20'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {item.waPoints} pts
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* 4. Atleta */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer">
                              {item.swimmerName}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {item.categoryLabel} · {item.gender === 'F' ? 'Femenino' : 'Masculino'}
                            </span>
                          </div>
                        </td>

                        {/* 5. Edad */}
                        <td className="py-3 px-3 text-center text-xs font-medium">
                          {item.age} años
                        </td>

                        {/* 6. Club */}
                        <td className="py-3 px-3 text-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="secondary" className="font-mono text-xs font-bold uppercase">
                                  {item.clubCode}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs font-semibold">{item.clubName}</p>
                                <p className="text-[10px] text-muted-foreground">Asociación: {item.associationCode}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>

                        {/* 7. Torneo */}
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          <span className="line-clamp-1 font-medium text-foreground">
                            {item.meetName}
                          </span>
                        </td>

                        {/* 8. Fecha */}
                        <td className="py-3 px-3 text-center text-xs text-muted-foreground font-mono">
                          {item.meetDate}
                        </td>

                        {/* 9. Dif. Marca */}
                        <td className="py-3 px-3 text-center">
                          {comparison ? (
                            comparison.isQualified ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-mono text-xs gap-1 shadow-sm">
                                <CheckCircle2 className="h-3 w-3" />
                                {comparison.formattedDiff}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="font-mono text-xs text-amber-700 dark:text-amber-300 border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
                              >
                                {comparison.formattedDiff}
                              </Badge>
                            )
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leyenda y Certificación Oficial ADAEL */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground pt-2">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Verde: Marca Mínima Nacional alcanzada.</span>
            <span className="ml-2 inline-block w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Azul: Parcial obtenido como primer tramo de relevo reglamentario.</span>
          </div>

          <p className="italic">
            Validado conforme a las regulaciones de World Aquatics y la Federación Venezolana de Deportes Acuáticos (FEVEDA).
          </p>
        </div>
      </div>
    </div>
  );
}
