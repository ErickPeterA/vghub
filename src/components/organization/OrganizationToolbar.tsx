import { Maximize2, Minus, RotateCcw, Search, Shrink, ZoomIn } from "lucide-react";

type OrganizationToolbarProps = {
  query: string;
  zoom: number;
  onQueryChange: (value: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFit: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
};

const iconButton = "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#042558]/15 bg-white text-[#042558] transition hover:bg-[#042558]/5";

export function OrganizationToolbar({
  query,
  zoom,
  onQueryChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFit,
  onExpandAll,
  onCollapseAll,
}: OrganizationToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#042558]/10 bg-white/80 p-4 shadow-sm backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="relative min-w-0 flex-1 lg:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#042558]/40" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar cargo..."
          className="w-full rounded-lg border border-[#042558]/15 bg-white px-9 py-2 text-sm text-[#042558] outline-none transition focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/15"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onZoomOut} className={iconButton} title="Zoom menos">
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-14 rounded-lg bg-[#042558]/10 px-2 py-2 text-center text-xs font-semibold text-[#042558]">
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" onClick={onZoomIn} className={iconButton} title="Zoom mais">
          <ZoomIn className="h-4 w-4" />
        </button>
        <button type="button" onClick={onResetZoom} className={iconButton} title="Restaurar zoom">
          <RotateCcw className="h-4 w-4" />
        </button>
        <button type="button" onClick={onFit} className={iconButton} title="Ajustar à tela">
          <Maximize2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={onExpandAll} className="rounded-lg border border-[#042558]/15 bg-white px-3 py-2 text-xs font-medium text-[#042558] hover:bg-[#042558]/5">
          Expandir todos
        </button>
        <button type="button" onClick={onCollapseAll} className="inline-flex items-center gap-1 rounded-lg border border-[#042558]/15 bg-white px-3 py-2 text-xs font-medium text-[#042558] hover:bg-[#042558]/5">
          <Shrink className="h-3.5 w-3.5" />
          Recolher todos
        </button>
      </div>
    </div>
  );
}
