/**
 * Centralised, allow-listed actions Webu (the voice assistant) may perform.
 * Nothing outside this registry can be triggered by the AI.
 * Phase 2 can register contextual tools (workspace, study, games) here.
 */
export const WEBU_PAGES = {
  dashboard: "/dashboard",
  ai: "/ai",
  chat: "/chat",
  workspace: "/workspace",
  study: "/study",
  games: "/games",
  music: "/music",
  membership: "/membership",
  settings: "/settings",
} as const;

export type WebuPage = keyof typeof WEBU_PAGES;

type Navigate = (opts: { to: string }) => void;

export function createWebuActions(navigate: Navigate) {
  const navigateToPage = (page: WebuPage) => {
    const to = WEBU_PAGES[page];
    if (to) navigate({ to });
  };
  return {
    navigateToPage,
    openHome: () => navigateToPage("dashboard"),
    openAIAssistant: () => navigateToPage("ai"),
    openChat: () => navigateToPage("chat"),
    openWorkspace: () => navigateToPage("workspace"),
    openStudy: () => navigateToPage("study"),
    openGames: () => navigateToPage("games"),
    openMusic: () => navigateToPage("music"),
    openMembership: () => navigateToPage("membership"),
    openSettings: () => navigateToPage("settings"),
    search: (query: string) => window.dispatchEvent(new CustomEvent("webu:search", { detail: query })),
  };
}

export type WebuCommand = { action: "navigate" | "search" | "answer"; page: WebuPage | null; query: string | null; reply: string };

export function executeWebuCommand(cmd: WebuCommand, navigate: Navigate) {
  const actions = createWebuActions(navigate);
  if (cmd.action === "navigate" && cmd.page && cmd.page in WEBU_PAGES) {
    setTimeout(() => actions.navigateToPage(cmd.page!), 500);
  } else if (cmd.action === "search" && cmd.query) {
    // Search lives on Home — go there, then hand over the query.
    navigate({ to: "/dashboard" });
    setTimeout(() => actions.search(cmd.query!), 400);
  }
}
