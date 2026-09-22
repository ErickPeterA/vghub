import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  FileSpreadsheet,
  FileText,
  Loader2,
  MoveDown,
  Pencil,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { apiJson } from "@/lib/api";
import type { OrganizationPosition } from "@/lib/organization";
import { getChildren } from "@/lib/organization";
import { useProjectFields } from "@/components/DynamicFields";
import { getDcSpreadsheetSheetNames, parseDcSpreadsheet } from "@/lib/dc-spreadsheet-import";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LinkedDescription = {
  id: string;
  cargo: string;
};

type PositionDetailsPanelProps = {
  projectId: string;
  position: OrganizationPosition | null;
  positions: OrganizationPosition[];
  onClose: () => void;
  onEdit: (position: OrganizationPosition) => void;
  onMove: (position: OrganizationPosition) => void;
  onAddChild: (position: OrganizationPosition) => void;
};

export function PositionDetailsPanel({
  projectId,
  position,
  positions,
  onClose,
  onEdit,
  onMove,
  onAddChild,
}: PositionDetailsPanelProps) {
  const navigate = useNavigate();
  const [linkedDescription, setLinkedDescription] = useState<LinkedDescription | null>(null);
  const [loadingDescription, setLoadingDescription] = useState(false);
  const [importing, setImporting] = useState(false);
  const [draggingFile, setDraggingFile] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const { fields, loading: loadingFields } = useProjectFields(projectId);

  useEffect(() => {
    if (!position) {
      setLinkedDescription(null);
      return;
    }

    let cancelled = false;
    setLoadingDescription(true);
    void (async () => {
      try {
        const { description } = await apiJson<{
          ok: boolean;
          description: LinkedDescription | null;
        }>(`/api/projects/${projectId}/dc?mode=position-description&positionId=${position.id}`);
        if (!cancelled) setLinkedDescription(description ?? null);
      } finally {
        if (!cancelled) setLoadingDescription(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [position, projectId]);

  if (!position) return null;

  const children = getChildren(positions, position.id);

  const openDescription = () => {
    if (linkedDescription) {
      navigate({
        to: "/projetos/$projectId/descricao-cargo/$dcId",
        params: { projectId, dcId: linkedDescription.id },
      });
      return;
    }

    navigate({
      to: "/projetos/$projectId/descricao-cargo/novo",
      params: { projectId },
      search: { positionId: position.id } as never,
    });
  };

  const openFilePicker = () => {
    document.getElementById(`dc-import-file-${position.id}`)?.click();
  };

  const inspectFile = async (file: File | undefined) => {
    if (!file || linkedDescription) return;
    setImporting(true);
    try {
      const names = await getDcSpreadsheetSheetNames(file);
      setPendingFile(file);
      setSheetNames(names);
      setSelectedSheet("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler a planilha.");
    } finally {
      setImporting(false);
      setDraggingFile(false);
    }
  };

  const importSelectedSheet = async () => {
    if (!pendingFile || !selectedSheet) return;
    setImporting(true);
    try {
      const { draft, sheetName, mappedFields } = await parseDcSpreadsheet(
        pendingFile,
        fields,
        selectedSheet,
      );
      // A hierarquia vem do organograma; os campos da descrição vêm da planilha.
      draft.organization_position_id = position.id;
      sessionStorage.setItem(
        `dc-import:${projectId}:${position.id}`,
        JSON.stringify({
          ...draft,
          __import: { fileName: pendingFile.name, sheetName, mappedFields },
        }),
      );
      toast.success(
        `${mappedFields} campo(s) lido(s). Cargo identificado: ${draft.cargo}. Revise a descrição antes de criar.`,
      );
      navigate({
        to: "/projetos/$projectId/descricao-cargo/novo",
        params: { projectId },
        search: { positionId: position.id } as never,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler a planilha.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-[#042558]/10 bg-white p-6 shadow-2xl">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/45">Cargo</p>
          <h2 className="mt-1 text-xl font-bold text-[#042558]">{position.nome}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-[#042558]/45 hover:bg-[#042558]/10 hover:text-[#042558]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#042558]/45">
          Subordinados diretos
        </h3>
        <div className="mt-2 space-y-2">
          {children.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#042558]/15 bg-[#042558]/5 px-3 py-3 text-sm text-[#042558]/55">
              Nenhum subordinado direto.
            </p>
          ) : (
            children.map((child) => (
              <div
                key={child.id}
                className="rounded-lg border border-[#042558]/10 bg-[#042558]/5 px-3 py-2 text-sm font-medium text-[#042558]"
              >
                {child.nome}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-2">
        <button
          type="button"
          onClick={openDescription}
          disabled={loadingDescription}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#042558] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#042558]/90 disabled:opacity-60"
        >
          {loadingDescription ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {linkedDescription ? "Abrir descrição de cargo" : "Criar descrição de cargo"}
        </button>
        {!linkedDescription && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => !importing && !loadingFields && openFilePicker()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") openFilePicker();
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDraggingFile(true);
            }}
            onDragLeave={() => setDraggingFile(false)}
            onDrop={(event) => {
              event.preventDefault();
              void inspectFile(event.dataTransfer.files.item(0) ?? undefined);
            }}
            className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-3 text-center transition ${
              draggingFile
                ? "border-[#042558] bg-[#042558]/10"
                : "border-[#042558]/25 bg-[#042558]/[0.03] hover:border-[#042558]/50 hover:bg-[#042558]/[0.06]"
            } ${importing || loadingFields ? "pointer-events-none opacity-60" : ""}`}
          >
            <input
              id={`dc-import-file-${position.id}`}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="sr-only"
              onChange={(event) => {
                void inspectFile(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#042558]">
              {importing || loadingFields ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Importar descrição de cargo
            </div>
            <p className="mt-1 text-xs text-[#042558]/55">
              <FileSpreadsheet className="mr-1 inline h-3.5 w-3.5" />
              Arraste a planilha ou clique e escolha qual aba deseja importar.
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => onEdit(position)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#042558]/20 bg-white px-4 py-2.5 text-sm font-medium text-[#042558] hover:bg-[#042558]/5"
        >
          <Pencil className="h-4 w-4" />
          Editar cargo
        </button>
        <button
          type="button"
          onClick={() => onMove(position)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#042558]/20 bg-white px-4 py-2.5 text-sm font-medium text-[#042558] hover:bg-[#042558]/5"
        >
          <MoveDown className="h-4 w-4" />
          Alterar superior
        </button>
        <button
          type="button"
          onClick={() => onAddChild(position)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#042558]/20 bg-white px-4 py-2.5 text-sm font-medium text-[#042558] hover:bg-[#042558]/5"
        >
          <Plus className="h-4 w-4" />
          Adicionar subordinado
        </button>
      </div>

      <Dialog
        open={Boolean(pendingFile)}
        onOpenChange={(open) => {
          if (!open && !importing) {
            setPendingFile(null);
            setSheetNames([]);
            setSelectedSheet("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escolha a aba da descrição</DialogTitle>
            <DialogDescription>
              Selecione uma aba de {pendingFile?.name}. Somente ela será lida e usada para preencher
              a descrição de cargo.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-2 overflow-y-auto py-2">
            {sheetNames.map((sheetName) => (
              <label
                key={sheetName}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                  selectedSheet === sheetName
                    ? "border-[#042558] bg-[#042558]/10 text-[#042558]"
                    : "border-border hover:bg-muted/60"
                }`}
              >
                <input
                  type="radio"
                  name="dc-sheet"
                  value={sheetName}
                  checked={selectedSheet === sheetName}
                  onChange={() => setSelectedSheet(sheetName)}
                  disabled={importing}
                />
                <FileSpreadsheet className="h-4 w-4 shrink-0" />
                <span className="truncate font-medium">{sheetName}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setPendingFile(null)}
              disabled={importing}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void importSelectedSheet()}
              disabled={!selectedSheet || importing}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#042558] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              Importar aba selecionada
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
