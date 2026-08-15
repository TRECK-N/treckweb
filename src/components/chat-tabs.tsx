import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Compass, MessageCircle } from "lucide-react";

const TABS = [
  { id: "hub", label: "Discover", to: "/chat", icon: Compass },
  { id: "messages", label: "Messages", to: "/messages", icon: MessageCircle },
] as const;

export function ChatTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeId = pathname.startsWith("/messages") ? "messages" : "hub";

  return (
    <div className="border-b border-border/60 px-4 lg:px-6 pt-3 pb-0 glass">
      <div className="glass rounded-2xl p-1.5 inline-flex gap-1">
        {TABS.map((t) => {
          const active = activeId === t.id;
          return (
            <Link
              key={t.id}
              to={t.to}
              className={`relative px-4 py-1.5 rounded-xl text-sm font-medium transition inline-flex items-center gap-1.5 ${
                active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="chat-tab-pill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary to-primary-glow shadow-[var(--shadow-glow)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <t.icon className="relative h-3.5 w-3.5" />
              <span className="relative">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
