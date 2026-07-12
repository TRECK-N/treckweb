import { createFileRoute } from "@tanstack/react-router";
import { GroupsEmpty } from "./groups";

export const Route = createFileRoute("/_authenticated/groups/")({
  component: GroupsEmpty,
});
