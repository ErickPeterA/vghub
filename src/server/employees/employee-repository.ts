import { query } from "@/server/db/pool";
import { requireCanManageProject, requireCanReadProject } from "@/server/projects/project-permissions";

type EmployeeRow = {
  id: string;
  project_id: string;
  position_id: string;
  area_id: string | null;
  sector_id: string | null;
  superior_imediato_id: string | null;
  nome: string;
  admission_date: Date | string;
  last_performance_review_date: Date | string | null;
  created_at: Date | string;
};

const isoDate = (value: Date | string | null) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value;
const iso = (value: Date | string) => (value instanceof Date ? value.toISOString() : value);

function mapEmployee(row: EmployeeRow) {
  return {
    ...row,
    admission_date: isoDate(row.admission_date),
    last_performance_review_date: isoDate(row.last_performance_review_date),
    created_at: iso(row.created_at),
  };
}

export async function getEmployeesPageData(userId: string, projectId: string) {
  await requireCanReadProject(userId, projectId);

  const [employees, positions, areas] = await Promise.all([
    query<EmployeeRow>(
      `
        select id, project_id, position_id, area_id, sector_id, superior_imediato_id, nome,
               admission_date, last_performance_review_date, created_at
        from public.project_employees
        where project_id = $1::uuid
        order by nome
      `,
      [projectId],
    ),
    query(
      `
        select id, nome, parent_id, display_order, created_at
        from public.project_positions
        where project_id = $1::uuid and status = 'active'::public.organization_position_status
        order by display_order, created_at
      `,
      [projectId],
    ),
    query(
      `
        select id, project_id, parent_id, nome, display_order, created_at
        from public.project_areas
        where project_id = $1::uuid
        order by display_order, created_at
      `,
      [projectId],
    ),
  ]);

  return {
    employees: employees.rows.map(mapEmployee),
    positions: positions.rows,
    areas: areas.rows,
  };
}

export async function createEmployee(input: {
  actorUserId: string;
  projectId: string;
  positionId: string;
  areaId?: string | null;
  sectorId?: string | null;
  superiorImediatoId?: string | null;
  nome: string;
  admissionDate: string;
  lastPerformanceReviewDate?: string | null;
}) {
  await requireCanManageProject(input.actorUserId, input.projectId);
  const result = await query<EmployeeRow>(
    `
      insert into public.project_employees (
        project_id, position_id, area_id, sector_id, superior_imediato_id, nome,
        admission_date, last_performance_review_date, created_by
      )
      values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7::date, $8::date, $9::uuid)
      returning id, project_id, position_id, area_id, sector_id, superior_imediato_id, nome,
                admission_date, last_performance_review_date, created_at
    `,
    [
      input.projectId,
      input.positionId,
      input.areaId ?? null,
      input.sectorId ?? null,
      input.superiorImediatoId ?? null,
      input.nome,
      input.admissionDate,
      input.lastPerformanceReviewDate ?? null,
      input.actorUserId,
    ],
  );

  return mapEmployee(result.rows[0]);
}
