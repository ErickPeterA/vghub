import { query, withTransaction } from "@/server/db/pool";
import { HttpError } from "@/server/http/errors";
import {
  requireCanManageProject,
  requireCanReadProject,
} from "@/server/projects/project-permissions";

type EmployeeRow = {
  id: string;
  project_id: string;
  position_id: string;
  area_id: string | null;
  sector_id: string | null;
  superior_imediato_id: string | null;
  nome: string;
  email: string | null;
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
        select id, project_id, position_id, area_id, sector_id, superior_imediato_id, nome, email,
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
  email?: string | null;
  admissionDate: string;
  lastPerformanceReviewDate?: string | null;
}) {
  await requireCanManageProject(input.actorUserId, input.projectId);
  const result = await query<EmployeeRow>(
    `
      insert into public.project_employees (
        project_id, position_id, area_id, sector_id, superior_imediato_id, nome, email,
        admission_date, last_performance_review_date, created_by
      )
      values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8::date, $9::date, $10::uuid)
      returning id, project_id, position_id, area_id, sector_id, superior_imediato_id, nome, email,
                admission_date, last_performance_review_date, created_at
    `,
    [
      input.projectId,
      input.positionId,
      input.areaId ?? null,
      input.sectorId ?? null,
      input.superiorImediatoId ?? null,
      input.nome,
      input.email?.trim() || null,
      input.admissionDate,
      input.lastPerformanceReviewDate ?? null,
      input.actorUserId,
    ],
  );

  return mapEmployee(result.rows[0]);
}

export async function updateEmployee(input: {
  actorUserId: string;
  projectId: string;
  employeeId: string;
  positionId: string;
  areaId?: string | null;
  sectorId?: string | null;
  superiorImediatoId?: string | null;
  nome: string;
  email?: string | null;
  admissionDate: string;
  lastPerformanceReviewDate?: string | null;
}) {
  await requireCanManageProject(input.actorUserId, input.projectId);

  return withTransaction(async (client) => {
    const result = await client.query<EmployeeRow>(
      `
        update public.project_employees
           set position_id = $3::uuid,
               area_id = $4::uuid,
               sector_id = $5::uuid,
               superior_imediato_id = $6::uuid,
               nome = $7,
               email = $8,
               admission_date = $9::date,
               last_performance_review_date = $10::date,
               updated_at = now()
         where id = $1::uuid
           and project_id = $2::uuid
        returning id, project_id, position_id, area_id, sector_id, superior_imediato_id, nome, email,
                  admission_date, last_performance_review_date, created_at
      `,
      [
        input.employeeId,
        input.projectId,
        input.positionId,
        input.areaId ?? null,
        input.sectorId ?? null,
        input.superiorImediatoId ?? null,
        input.nome,
        input.email?.trim() || null,
        input.admissionDate,
        input.lastPerformanceReviewDate ?? null,
      ],
    );

    if (!result.rows[0]) {
      throw new HttpError(404, "not_found", "Colaborador não encontrado.");
    }

    // These tables keep display-name snapshots. Keep them synchronized so the
    // edited employee is shown with the new name throughout the application.
    await client.query(
      `
        update public.performance_reviews
           set employee_name = $3,
               leader_name = coalesce(
                 (
                   select leader.nome
                     from public.project_employees employee
                     join public.project_employees leader on leader.id = employee.superior_imediato_id
                    where employee.id = $1::uuid
                      and employee.project_id = $2::uuid
                 ),
                 leader_name
               ),
               updated_at = now()
         where employee_id = $1::uuid
           and project_id = $2::uuid
      `,
      [input.employeeId, input.projectId, input.nome],
    );
    await client.query(
      `
        update public.performance_reviews review
           set leader_name = $3,
               updated_at = now()
         where review.project_id = $2::uuid
           and review.employee_id in (
             select employee.id
               from public.project_employees employee
              where employee.project_id = $2::uuid
                and employee.superior_imediato_id = $1::uuid
           )
      `,
      [input.employeeId, input.projectId, input.nome],
    );
    await client.query(
      `
        update public.pam
           set employee_name = $3,
               updated_at = now()
         where employee_id = $1::uuid
           and project_id = $2::uuid
      `,
      [input.employeeId, input.projectId, input.nome],
    );

    return mapEmployee(result.rows[0]);
  });
}
