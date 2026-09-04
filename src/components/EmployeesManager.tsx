import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Briefcase,
  Building2,
  CalendarDays,
  Loader2,
  Plus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PositionRow = {
  id: string;
  nome: string;
  parent_id: string | null;
  display_order: number;
  created_at: string;
};

type AreaRow = {
  id: string;
  project_id: string;
  parent_id: string | null;
  nome: string;
  display_order: number;
  created_at: string;
};

type EmployeeRow = {
  id: string;
  project_id: string;
  position_id: string;
  area_id: string | null;
  sector_id: string | null;
  superior_imediato_id: string | null;
  nome: string;
  admission_date: string;
  last_performance_review_date: string | null;
  created_at: string;
};

type EmployeeFormState = {
  nome: string;
  positionId: string;
  areaId: string;
  sectorId: string;
  superiorImediatoId: string;
  admissionDate: string;
  lastPerformanceReviewDate: string;
};

const emptyForm: EmployeeFormState = {
  nome: "",
  positionId: "",
  areaId: "",
  sectorId: "",
  superiorImediatoId: "",
  admissionDate: "",
  lastPerformanceReviewDate: "",
};

const inputClass =
  "w-full rounded-lg border border-[#042558]/20 bg-white/70 px-3 py-2 text-sm text-[#042558] outline-none transition focus:border-[#042558] focus:ring-2 focus:ring-[#042558]/20 disabled:bg-[#042558]/5 disabled:text-[#042558]/35";

export function EmployeesManager({ projectId }: { projectId: string }) {
  const nameRef = useRef<HTMLInputElement | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<EmployeeFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{
        ok: boolean;
        employees: EmployeeRow[];
        positions: PositionRow[];
        areas: AreaRow[];
      }>(`/api/projects/${projectId}/employees`);
      setEmployees(data.employees);
      setPositions(data.positions);
      setAreas(data.areas);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar colaboradores.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!formOpen) return;
    window.setTimeout(() => nameRef.current?.focus(), 50);
  }, [formOpen]);

  const areaOptions = useMemo(() => areas.filter((area) => !area.parent_id), [areas]);
  const sectorOptions = useMemo(
    () => areas.filter((area) => area.parent_id === (form.areaId || null)),
    [areas, form.areaId],
  );
  const positionsById = useMemo(
    () => new Map(positions.map((position) => [position.id, position])),
    [positions],
  );
  const areasById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );
  const ancestorPositionIds = useMemo(() => {
    if (!form.positionId) return [];

    const ids: string[] = [];
    const seen = new Set<string>();
    let currentId: string | null = form.positionId;

    while (currentId) {
      const current = positionsById.get(currentId);
      const parentId = current?.parent_id ?? null;
      if (!parentId || seen.has(parentId)) break;
      seen.add(parentId);
      ids.push(parentId);
      currentId = parentId;
    }

    return ids;
  }, [form.positionId, positionsById]);
  const leaderOptions = useMemo(() => {
    const ancestorDepthByPosition = new Map(
      ancestorPositionIds.map((positionId, index) => [positionId, index + 1]),
    );

    return employees
      .filter((employee) => ancestorDepthByPosition.has(employee.position_id))
      .map((employee) => ({
        employee,
        position: positionsById.get(employee.position_id),
        depth: ancestorDepthByPosition.get(employee.position_id) ?? 999,
      }))
      .sort((a, b) => a.depth - b.depth || a.employee.nome.localeCompare(b.employee.nome, "pt-BR"));
  }, [ancestorPositionIds, employees, positionsById]);

  useEffect(() => {
    const optionIds = new Set(leaderOptions.map((option) => option.employee.id));
    if (!form.positionId) {
      setForm((current) =>
        current.superiorImediatoId ? { ...current, superiorImediatoId: "" } : current,
      );
      return;
    }

    if (form.superiorImediatoId && !optionIds.has(form.superiorImediatoId)) {
      setForm((current) => ({ ...current, superiorImediatoId: "" }));
      return;
    }

    if (!form.superiorImediatoId && leaderOptions.length === 1) {
      setForm((current) => ({ ...current, superiorImediatoId: leaderOptions[0].employee.id }));
    }
  }, [form.positionId, form.superiorImediatoId, leaderOptions]);

  const setField = (field: keyof EmployeeFormState, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "areaId" ? { sectorId: "" } : null),
      ...(field === "positionId" ? { superiorImediatoId: "" } : null),
    }));
  };

  const createEmployee = async (event: FormEvent) => {
    event.preventDefault();
    const nome = form.nome.trim();
    if (!nome) return toast.error("Nome do funcionario e obrigatorio.");
    if (!form.positionId) return toast.error("Selecione um cargo do organograma.");
    if (leaderOptions.length > 0 && !form.superiorImediatoId) {
      return toast.error("Selecione o lider sugerido pelo organograma.");
    }
    if (!form.admissionDate) return toast.error("Informe a data de admissao.");
    if (form.lastPerformanceReviewDate && form.lastPerformanceReviewDate < form.admissionDate) {
      return toast.error("A ultima avaliacao nao pode ser anterior a admissao.");
    }

    setSaving(true);
    try {
      await apiJson(`/api/projects/${projectId}/employees`, {
        method: "POST",
        body: {
          positionId: form.positionId,
          areaId: form.areaId || null,
          sectorId: form.sectorId || null,
          superiorImediatoId: form.superiorImediatoId || null,
          nome,
          admissionDate: form.admissionDate,
          lastPerformanceReviewDate: form.lastPerformanceReviewDate || null,
        },
      });
    } catch (error) {
      setSaving(false);
      return toast.error(error instanceof Error ? error.message : "Erro ao cadastrar colaborador.");
    }
    setSaving(false);

    toast.success("Colaborador cadastrado");
    setForm(emptyForm);
    await load();
    nameRef.current?.focus();
  };

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#042558]/5 via-white to-[#042558]/5 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-2xl border border-[#042558]/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#042558]/50">
                Projeto
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#042558]">
                Colaboradores
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[#042558]/55">
                Cadastre pessoas vinculadas aos cargos do organograma e aos setores do projeto.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setFormOpen(true)}
              className="bg-[#042558] text-white hover:bg-[#042558]/90"
            >
              <UserPlus className="h-4 w-4" />
              Cadastrar colaborador
            </Button>
          </div>
        </div>

        <section className="rounded-2xl border border-[#042558]/10 bg-white/70 p-5 shadow-sm backdrop-blur-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">
                Lista de colaboradores
              </h2>
              <p className="mt-1 text-xs text-[#042558]/50">
                Os cargos vem do organograma. Os setores aparecem conforme a area escolhida.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[#042558]">
              <Metric icon={Users} label="Pessoas" value={employees.length} />
              <Metric icon={Briefcase} label="Cargos" value={positions.length} />
              <Metric icon={Building2} label="Areas" value={areaOptions.length} />
            </div>
          </div>

          {loading ? (
            <div className="flex h-44 items-center justify-center rounded-xl border border-[#042558]/10 bg-white/50 text-sm text-[#042558]/55">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando colaboradores...
            </div>
          ) : employees.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#042558]/15 bg-white/50 p-8 text-center">
              <Users className="mb-3 h-10 w-10 text-[#042558]/20" />
              <p className="text-sm font-medium text-[#042558]/60">
                Nenhum colaborador cadastrado.
              </p>
              <p className="mt-1 text-xs text-[#042558]/40">
                Abra o formulario acima para criar o primeiro registro.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#042558]/10">
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Area / Setor</TableHead>
                  <TableHead>Superior imediato</TableHead>
                  <TableHead>Admissao</TableHead>
                  <TableHead>Ultima avaliacao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id} className="border-[#042558]/10">
                    <TableCell className="font-medium text-[#042558]">{employee.nome}</TableCell>
                    <TableCell className="text-[#042558]/70">
                      {positionsById.get(employee.position_id)?.nome ?? "Cargo removido"}
                    </TableCell>
                    <TableCell className="text-[#042558]/70">
                      <div className="flex flex-col">
                        <span>{areasById.get(employee.area_id ?? "")?.nome ?? "-"}</span>
                        <span className="text-xs text-[#042558]/45">
                          {areasById.get(employee.sector_id ?? "")?.nome ?? "Sem setor"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#042558]/70">
                      {employeesById.get(employee.superior_imediato_id ?? "")?.nome ?? "-"}
                    </TableCell>
                    <TableCell className="text-[#042558]/70">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(employee.admission_date)}
                      </span>
                    </TableCell>
                    <TableCell className="text-[#042558]/70">
                      {formatDate(employee.last_performance_review_date)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#042558]/25 px-4 py-6 backdrop-blur-sm">
          <form
            onSubmit={createEmployee}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#042558]/10 bg-white p-5 shadow-2xl shadow-[#042558]/20"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[#042558]">
                  Novo funcionario
                </h2>
                <p className="mt-1 text-xs text-[#042558]/50">
                  Pressione Enter para cadastrar e continuar preenchendo o proximo.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-[#042558]/10 text-[#042558]">
                  {employees.length} cadastrado(s)
                </Badge>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-md p-2 text-[#042558]/45 transition hover:bg-[#042558]/10 hover:text-[#042558]"
                  aria-label="Fechar formulario"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#042558]/70">Nome</span>
                <input
                  ref={nameRef}
                  value={form.nome}
                  onChange={(event) => setField("nome", event.target.value)}
                  className={inputClass}
                  placeholder="Nome completo"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#042558]/70">Cargo</span>
                <select
                  value={form.positionId}
                  onChange={(event) => setField("positionId", event.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecione um cargo</option>
                  {positions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#042558]/70">Area</span>
                <select
                  value={form.areaId}
                  onChange={(event) => setField("areaId", event.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecione uma area</option>
                  {areaOptions.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#042558]/70">Setor</span>
                <select
                  value={form.sectorId}
                  onChange={(event) => setField("sectorId", event.target.value)}
                  className={inputClass}
                  disabled={!form.areaId}
                >
                  <option value="">
                    {form.areaId ? "Selecione um setor" : "Selecione uma area primeiro"}
                  </option>
                  {sectorOptions.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#042558]/70">
                  Lider pelo organograma
                </span>
                <select
                  value={form.superiorImediatoId}
                  onChange={(event) => setField("superiorImediatoId", event.target.value)}
                  className={inputClass}
                  disabled={!form.positionId || leaderOptions.length === 0}
                >
                  <option value="">
                    {!form.positionId
                      ? "Selecione um cargo primeiro"
                      : leaderOptions.length === 0
                        ? "Nenhum funcionario em cargos superiores"
                        : "Selecione o lider"}
                  </option>
                  {leaderOptions.map(({ employee, position, depth }) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.nome} - {position?.nome ?? "cargo removido"}
                      {depth === 1 ? " - superior direto" : ` - ${depth} niveis acima`}
                    </option>
                  ))}
                </select>
                {form.positionId && leaderOptions.length > 0 && (
                  <p className="mt-1 text-xs text-[#042558]/45">
                    Opcoes puxadas dos cargos acima:{" "}
                    {ancestorPositionIds
                      .map((positionId) => positionsById.get(positionId)?.nome)
                      .filter(Boolean)
                      .join(" > ")}
                    .
                  </p>
                )}
                {form.positionId &&
                  leaderOptions.length === 0 &&
                  ancestorPositionIds.length > 0 && (
                    <p className="mt-1 text-xs text-[#042558]/45">
                      Cargos acima encontrados, mas sem colaboradores cadastrados neles:{" "}
                      {ancestorPositionIds
                        .map((positionId) => positionsById.get(positionId)?.nome)
                        .filter(Boolean)
                        .join(" > ")}
                      .
                    </p>
                  )}
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#042558]/70">
                  Data de admissao
                </span>
                <input
                  type="date"
                  value={form.admissionDate}
                  onChange={(event) => setField("admissionDate", event.target.value)}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#042558]/70">
                  Ultima avaliacao de desempenho
                </span>
                <input
                  type="date"
                  value={form.lastPerformanceReviewDate}
                  onChange={(event) => setField("lastPerformanceReviewDate", event.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#042558]/10 pt-4">
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#042558] text-white hover:bg-[#042558]/90"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Adicionar
              </Button>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Fechar formulario
              </Button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-20 rounded-lg border border-[#042558]/10 bg-white/70 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-[#042558]/45">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-0.5 text-lg font-semibold leading-none text-[#042558]">{value}</p>
    </div>
  );
}
