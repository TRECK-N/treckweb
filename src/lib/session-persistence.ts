// "Stay signed in" support. Supabase always persists the session in
// localStorage, so when the user opts out we mark the session as tab-scoped
// and sign out as soon as a fresh browsing session (new tab / restart) starts.
const PERSIST_KEY = "webuweb_persist_session";
const TAB_KEY = "webuweb_tab_session";

export function setSessionPersistence(stay: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PERSIST_KEY, stay ? "true" : "false");
  sessionStorage.setItem(TAB_KEY, "1");
}

/** Returns true when the stored session should be discarded. */
export function shouldDropSession() {
  if (typeof window === "undefined") return false;
  const persist = localStorage.getItem(PERSIST_KEY);
  if (persist !== "false") return false;
  return sessionStorage.getItem(TAB_KEY) !== "1";
}

export function clearSessionPersistence() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PERSIST_KEY);
  sessionStorage.removeItem(TAB_KEY);
}
