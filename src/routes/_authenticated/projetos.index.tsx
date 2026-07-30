import { createFileRoute } from "@tanstack/react-router";
import { ProjectListPage } from "@/components/ProjectListPage";

export const Route = createFileRoute("/_authenticated/projetos/")({
  component: ProjectListPage,
});
