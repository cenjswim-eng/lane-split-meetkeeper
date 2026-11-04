import { Activity, ArrowDownRight, Waves } from "lucide-react";

// Illustrative data only; never reads or exposes account records.
export function LandingProgress() {
  return (
    <figure className="landing-preview min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Waves className="size-5 shrink-0 text-primary" aria-hidden="true" /> Natación Pro
        </div>
        <span className="text-xs text-muted-foreground">Datos de ejemplo</span>
      </div>
      <div className="p-5 sm:p-7">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Progresión individual</p>
            <h2 className="mt-1 text-lg font-semibold">100 m Libre</h2>
            <p className="mt-1 text-sm text-muted-foreground">Piscina de 50 m</p>
          </div>
          <Activity className="size-5 shrink-0 text-primary" aria-hidden="true" />
        </div>
        <svg viewBox="0 0 440 235" className="mt-6 w-full" role="img" aria-label="Gráfica de ejemplo: el tiempo en 100 metros libre mejora de 1:12 a 1:06 entre marzo y agosto.">
          <g className="text-border" stroke="currentColor" strokeWidth="1">
            <path d="M54 24H422 M54 70H422 M54 116H422 M54 162H422" />
          </g>
          <g className="text-muted-foreground" fill="currentColor" fontSize="12" fontFamily="inherit">
            <text x="0" y="28">1:12</text><text x="0" y="74">1:10</text><text x="0" y="120">1:08</text><text x="0" y="166">1:06</text>
            <text x="54" y="204" textAnchor="middle">Mar</text><text x="126" y="204" textAnchor="middle">Abr</text><text x="198" y="204" textAnchor="middle">May</text><text x="270" y="204" textAnchor="middle">Jun</text><text x="342" y="204" textAnchor="middle">Jul</text><text x="414" y="204" textAnchor="middle">Ago</text>
          </g>
          <path d="M54 24L126 60L198 53L270 112L342 136L414 162" className="text-primary" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round" />
          <g className="text-primary" fill="currentColor" stroke="var(--card)" strokeWidth="3">
            {[[54,24],[126,60],[198,53],[270,112],[342,136],[414,162]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="5" />)}
          </g>
        </svg>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
          <span className="text-muted-foreground">Mejor tiempo</span>
          <span className="flex items-center gap-2 font-semibold"><ArrowDownRight className="size-4 text-primary" aria-hidden="true" /><span className="time">1:06.00</span></span>
        </div>
      </div>
    </figure>
  );
}