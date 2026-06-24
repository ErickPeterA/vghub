import { createFileRoute } from "@tanstack/react-router";
import { UsersManagementPage } from "@/components/UsersManagementPage";

export const Route = createFileRoute("/_authenticated/gerenciamento/usuarios/")({
  component: UsersManagementPage,
});