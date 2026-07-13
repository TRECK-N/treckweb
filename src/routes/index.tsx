import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, MessageCircle, FolderOpen, Music, Bot } from "lucide-react";
import auroraBg from "@/assets/aurora-bg.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <img
        src={auroraBg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-40 dark:opacity-30 pointer-events-none"
      />
      <div className="absolute inset-0 mesh-bg opacity-70" aria-hidden="true" />

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-bold text-xl">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-primary-glow shadow-[var(--shadow-glow)]" />
          TreckWeb
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/auth"
            className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground transition"
          >Sign in</Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition"
          >Get started <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pt-16 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5" /> Your all-in-one student workspace
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight">
            Study, chat and build.{" "}
            <span className="gradient-text">Beautifully.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            TreckWeb combines an AI assistant, live global chat, a Notion-style workspace and a personal store — in one Apple-quality space designed for students.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:scale-[1.02] transition"
            >Start for free <ArrowRight className="h-4 w-4" /></Link>
            <a href="#features" className="inline-flex items-center justify-center rounded-full glass px-7 py-3 text-sm font-semibold hover:bg-accent transition">
              Explore features
            </a>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Bot, title: "AI Assistant", desc: "Streaming chat with markdown, code blocks, threads and history." },
            { icon: MessageCircle, title: "Global Chat", desc: "Real-time chat with every online user. Emoji, edits, typing." },
            { icon: FolderOpen, title: "Workspace", desc: "Folders, notes, files & checklists. Auto-saved, always yours." },
            { icon: ShoppingBag, title: "Store", desc: "Sell products with a beautiful cart. Stripe-ready checkout." },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="glass rounded-2xl p-6 hover:shadow-[var(--shadow-glow)] transition"
            >
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground shadow-[var(--shadow-glow)]">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/50 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} TreckWeb. Crafted for students.
      </footer>
    </div>
  );
}
