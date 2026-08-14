import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "ro", label: "Română", flag: "🇷🇴" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];

type Dict = Record<string, string>;

const en: Dict = {
  "nav.home": "Home",
  "nav.ai": "AI Assistant",
  "nav.chat": "Chat",
  "nav.workspace": "Workspace",
  "nav.study": "Study",
  "nav.games": "Games",
  "nav.music": "Music",
  "nav.membership": "Membership",
  "nav.settings": "Settings",
  "nav.signOut": "Sign out",

  "common.search": "Search",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.create": "Create",
  "common.loading": "Loading…",
  "common.back": "Back",
  "common.language": "Language",
  "common.theme": "Theme",

  "dashboard.greeting": "Welcome back",
  "dashboard.subtitle": "Everything you need, in one place.",
  "dashboard.searchPlaceholder": "Search people, groups, notes and files…",

  "study.title": "Study",
  "study.subtitle": "Flashcards, quizzes and notes — build them yourself or let AI do it.",
  "study.flashcards": "Flashcards",
  "study.quizzes": "Quizzes",
  "study.notes": "Notes",

  "games.title": "Games",
  "games.subtitle": "Take a break — play solo or challenge your friends.",
  "games.play": "Play",
  "games.score": "Score",
  "games.best": "Best",
  "games.newGame": "New game",
  "games.playAgain": "Play again",
  "games.gameOver": "Game over",
  "games.paused": "Paused",

  "settings.title": "Settings",
  "settings.profile": "Profile",
  "settings.appearance": "Appearance",
  "settings.languageHint": "Choose the language used across WebuWeb.",
};

const de: Dict = {
  "nav.home": "Start", "nav.ai": "KI-Assistent", "nav.chat": "Chat", "nav.workspace": "Arbeitsbereich",
  "nav.study": "Lernen", "nav.games": "Spiele", "nav.music": "Musik", "nav.membership": "Mitgliedschaft",
  "nav.settings": "Einstellungen", "nav.signOut": "Abmelden",
  "common.search": "Suchen", "common.save": "Speichern", "common.cancel": "Abbrechen", "common.delete": "Löschen",
  "common.create": "Erstellen", "common.loading": "Lädt…", "common.back": "Zurück", "common.language": "Sprache", "common.theme": "Design",
  "dashboard.greeting": "Willkommen zurück", "dashboard.subtitle": "Alles was du brauchst, an einem Ort.",
  "dashboard.searchPlaceholder": "Personen, Gruppen, Notizen und Dateien suchen…",
  "study.title": "Lernen", "study.subtitle": "Karteikarten, Quiz und Notizen — selbst erstellen oder von der KI.",
  "study.flashcards": "Karteikarten", "study.quizzes": "Quiz", "study.notes": "Notizen",
  "games.title": "Spiele", "games.subtitle": "Mach eine Pause — allein oder mit Freunden.",
  "games.play": "Spielen", "games.score": "Punkte", "games.best": "Bestwert", "games.newGame": "Neues Spiel",
  "games.playAgain": "Nochmal spielen", "games.gameOver": "Spiel vorbei", "games.paused": "Pausiert",
  "settings.title": "Einstellungen", "settings.profile": "Profil", "settings.appearance": "Darstellung",
  "settings.languageHint": "Wähle die Sprache für WebuWeb.",
};

const it: Dict = {
  "nav.home": "Home", "nav.ai": "Assistente IA", "nav.chat": "Chat", "nav.workspace": "Spazio di lavoro",
  "nav.study": "Studio", "nav.games": "Giochi", "nav.music": "Musica", "nav.membership": "Abbonamento",
  "nav.settings": "Impostazioni", "nav.signOut": "Esci",
  "common.search": "Cerca", "common.save": "Salva", "common.cancel": "Annulla", "common.delete": "Elimina",
  "common.create": "Crea", "common.loading": "Caricamento…", "common.back": "Indietro", "common.language": "Lingua", "common.theme": "Tema",
  "dashboard.greeting": "Bentornato", "dashboard.subtitle": "Tutto ciò che ti serve, in un unico posto.",
  "dashboard.searchPlaceholder": "Cerca persone, gruppi, note e file…",
  "study.title": "Studio", "study.subtitle": "Flashcard, quiz e note — creale tu o lascia fare all'IA.",
  "study.flashcards": "Flashcard", "study.quizzes": "Quiz", "study.notes": "Note",
  "games.title": "Giochi", "games.subtitle": "Fai una pausa — da solo o con gli amici.",
  "games.play": "Gioca", "games.score": "Punteggio", "games.best": "Record", "games.newGame": "Nuova partita",
  "games.playAgain": "Gioca ancora", "games.gameOver": "Partita finita", "games.paused": "In pausa",
  "settings.title": "Impostazioni", "settings.profile": "Profilo", "settings.appearance": "Aspetto",
  "settings.languageHint": "Scegli la lingua di WebuWeb.",
};

const fr: Dict = {
  "nav.home": "Accueil", "nav.ai": "Assistant IA", "nav.chat": "Discussion", "nav.workspace": "Espace de travail",
  "nav.study": "Études", "nav.games": "Jeux", "nav.music": "Musique", "nav.membership": "Abonnement",
  "nav.settings": "Paramètres", "nav.signOut": "Se déconnecter",
  "common.search": "Rechercher", "common.save": "Enregistrer", "common.cancel": "Annuler", "common.delete": "Supprimer",
  "common.create": "Créer", "common.loading": "Chargement…", "common.back": "Retour", "common.language": "Langue", "common.theme": "Thème",
  "dashboard.greeting": "Bon retour", "dashboard.subtitle": "Tout ce dont vous avez besoin, au même endroit.",
  "dashboard.searchPlaceholder": "Rechercher personnes, groupes, notes et fichiers…",
  "study.title": "Études", "study.subtitle": "Cartes, quiz et notes — créez-les ou laissez l'IA le faire.",
  "study.flashcards": "Cartes mémo", "study.quizzes": "Quiz", "study.notes": "Notes",
  "games.title": "Jeux", "games.subtitle": "Faites une pause — seul ou avec des amis.",
  "games.play": "Jouer", "games.score": "Score", "games.best": "Record", "games.newGame": "Nouvelle partie",
  "games.playAgain": "Rejouer", "games.gameOver": "Partie terminée", "games.paused": "En pause",
  "settings.title": "Paramètres", "settings.profile": "Profil", "settings.appearance": "Apparence",
  "settings.languageHint": "Choisissez la langue de WebuWeb.",
};

const es: Dict = {
  "nav.home": "Inicio", "nav.ai": "Asistente IA", "nav.chat": "Chat", "nav.workspace": "Espacio de trabajo",
  "nav.study": "Estudio", "nav.games": "Juegos", "nav.music": "Música", "nav.membership": "Membresía",
  "nav.settings": "Ajustes", "nav.signOut": "Cerrar sesión",
  "common.search": "Buscar", "common.save": "Guardar", "common.cancel": "Cancelar", "common.delete": "Eliminar",
  "common.create": "Crear", "common.loading": "Cargando…", "common.back": "Atrás", "common.language": "Idioma", "common.theme": "Tema",
  "dashboard.greeting": "Bienvenido de nuevo", "dashboard.subtitle": "Todo lo que necesitas, en un solo lugar.",
  "dashboard.searchPlaceholder": "Buscar personas, grupos, notas y archivos…",
  "study.title": "Estudio", "study.subtitle": "Tarjetas, cuestionarios y notas — créalos tú o deja que lo haga la IA.",
  "study.flashcards": "Tarjetas", "study.quizzes": "Cuestionarios", "study.notes": "Notas",
  "games.title": "Juegos", "games.subtitle": "Tómate un descanso — solo o con amigos.",
  "games.play": "Jugar", "games.score": "Puntos", "games.best": "Récord", "games.newGame": "Nueva partida",
  "games.playAgain": "Jugar otra vez", "games.gameOver": "Fin del juego", "games.paused": "En pausa",
  "settings.title": "Ajustes", "settings.profile": "Perfil", "settings.appearance": "Apariencia",
  "settings.languageHint": "Elige el idioma de WebuWeb.",
};

const ro: Dict = {
  "nav.home": "Acasă", "nav.ai": "Asistent AI", "nav.chat": "Chat", "nav.workspace": "Spațiu de lucru",
  "nav.study": "Învățare", "nav.games": "Jocuri", "nav.music": "Muzică", "nav.membership": "Abonament",
  "nav.settings": "Setări", "nav.signOut": "Deconectare",
  "common.search": "Caută", "common.save": "Salvează", "common.cancel": "Anulează", "common.delete": "Șterge",
  "common.create": "Creează", "common.loading": "Se încarcă…", "common.back": "Înapoi", "common.language": "Limbă", "common.theme": "Temă",
  "dashboard.greeting": "Bine ai revenit", "dashboard.subtitle": "Tot ce ai nevoie, într-un singur loc.",
  "dashboard.searchPlaceholder": "Caută persoane, grupuri, notițe și fișiere…",
  "study.title": "Învățare", "study.subtitle": "Carduri, teste și notițe —creează-le tu sau lasă AI-ul.",
  "study.flashcards": "Carduri", "study.quizzes": "Teste", "study.notes": "Notițe",
  "games.title": "Jocuri", "games.subtitle": "Ia o pauză — singur sau cu prietenii.",
  "games.play": "Joacă", "games.score": "Scor", "games.best": "Record", "games.newGame": "Joc nou",
  "games.playAgain": "Joacă din nou", "games.gameOver": "Joc terminat", "games.paused": "În pauză",
  "settings.title": "Setări", "settings.profile": "Profil", "settings.appearance": "Aspect",
  "settings.languageHint": "Alege limba folosită în WebuWeb.",
};

const DICTS: Record<Lang, Dict> = { en, de, it, fr, es, ro };

const STORAGE_KEY = "webuweb-lang";

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, fallback?: string) => string;
};

const I18nContext = createContext<I18nValue>({ lang: "en", setLang: () => {}, t: (k, f) => f ?? en[k] ?? k });

function detectLang(): Lang {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (stored && stored in DICTS) return stored;
  const nav = navigator.language.slice(0, 2) as Lang;
  return nav in DICTS ? nav : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    setLangState(detectLang());
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  // Load the saved language from the user's profile once signed in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;
      const { data: profile } = await supabase.from("profiles").select("language").eq("id", data.user.id).maybeSingle();
      const saved = profile?.language as Lang | null | undefined;
      if (!cancelled && saved && saved in DICTS && !localStorage.getItem(STORAGE_KEY)) setLangState(saved);
    })();
    return () => { cancelled = true; };
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) await supabase.from("profiles").update({ language: next }).eq("id", data.user.id);
    })();
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => DICTS[lang][key] ?? en[key] ?? fallback ?? key,
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
