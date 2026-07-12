import { createFileRoute } from "@tanstack/react-router";
import { MessagesEmpty } from "./messages";

export const Route = createFileRoute("/_authenticated/messages/")({
  component: MessagesEmpty,
});
