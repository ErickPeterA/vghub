import { createFileRoute } from "@tanstack/react-router";
import { EmployeesManager } from "@/components/EmployeesManager";

export const Route = createFileRoute("/_authenticated/projetos/$projectId/funcionarios")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const { projectId } = Route.useParams();
  return <EmployeesManager projectId={projectId} />;
}
