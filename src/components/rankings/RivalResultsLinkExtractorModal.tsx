/**
 * Modal Unificado: Importar Resultados y Extraer Marcas de Rivales
 * Ubicación: src/components/rankings/RivalResultsLinkExtractorModal.tsx
 *
 * Abre un diálogo interactivo con el Centro Unificado de Importación,
 * permitiendo subir archivos (.hy3, .cl2, .zip, .pdf, .mdb), enlaces web
 * o tablas de texto para alimentar el Ranking Estadal y los clubes rivales.
 */

import { useState } from "react";
import { Globe, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UnifiedResultsImportHub } from "@/components/imports/UnifiedResultsImportHub";
import type { UnifiedImportResult } from "@/lib/unified-import";

export function RivalResultsLinkExtractorModal({
  triggerButton,
  myClubCode = "JSWIM",
  onResultsImported,
}: {
  triggerButton?: React.ReactNode;
  myClubCode?: string;
  onResultsImported?: (count: number) => void;
}) {
  const [open, setOpen] = useState(false);

  const handleSuccess = (result: UnifiedImportResult) => {
    if (onResultsImported) {
      onResultsImported(result.resultsImported);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-semibold shadow-sm h-8 text-xs"
          >
            <Layers className="h-3.5 w-3.5 text-primary" />
            Importar Resultados / Rivales
            <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider py-0 px-1.5">
              Hub
            </Badge>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                Centro Unificado de Importación
                <Badge variant="outline" className="text-xs bg-muted/60 font-semibold text-primary border-primary/30">
                  Ranking Estadal y Club
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Sube archivos (.hy3, .cl2, .zip, .pdf, .mdb), pega enlaces oficiales (ADAEL, FEVEDA) o pega tablas de texto directamente en un solo lugar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="pt-2">
          <UnifiedResultsImportHub
            onSuccess={handleSuccess}
            defaultDestinations={{
              stateRanking: true,
              myClub: true,
              officialCircuit: true,
            }}
            compact={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
