"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  GitMerge,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Terminal,
  Type,
} from "lucide-react";

import type { NodeKind } from "@/lib/graph";

const PALETTE: Array<{ kind: NodeKind; label: string; icon: typeof Type }> = [
  { kind: "input", label: "Input", icon: Type },
  { kind: "llm", label: "Model", icon: Sparkles },
  { kind: "search", label: "Search", icon: Search },
  { kind: "join", label: "Join", icon: GitMerge },
  { kind: "output", label: "Output", icon: Terminal },
];

export function Toolbar({
  onAdd,
  onRun,
  onStop,
  onReset,
  running,
  issue,
  ms,
}: {
  onAdd: (kind: NodeKind) => void;
  onRun: () => void;
  onStop: () => void;
  onReset: () => void;
  running: boolean;
  issue?: string | null;
  ms: number | null;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-3 p-4">
      <div className="glass pointer-events-auto flex items-center gap-2 rounded-xl px-3 py-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-circuit text-white">
          <GitMerge className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight">circuit</span>
      </div>

      {/* the palette */}
      <div className="glass pointer-events-auto flex items-center gap-1 rounded-xl p-1.5">
        {PALETTE.map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            onClick={() => onAdd(kind)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted transition hover:bg-white/5 hover:text-text focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
            title={`Add a ${label} node`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="pointer-events-auto ml-auto flex items-center gap-2">
        {issue && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass flex max-w-sm items-center gap-2 rounded-xl px-3 py-2 text-xs text-fail"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{issue}</span>
          </motion.div>
        )}
        {ms !== null && !running && !issue && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-xl px-3 py-2 font-mono text-xs text-done"
          >
            ran in {ms} ms
          </motion.span>
        )}

        <button
          onClick={onReset}
          className="glass rounded-xl p-2.5 text-muted transition hover:text-text focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
          title="Reset the canvas"
          aria-label="Reset the canvas"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <button
          onClick={running ? onStop : onRun}
          disabled={Boolean(issue) && !running}
          className="flex items-center gap-2 rounded-xl bg-circuit px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary/25 transition hover:brightness-110 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
        >
          {running ? (
            <Square className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {running ? "Stop" : "Run"}
        </button>
      </div>
    </div>
  );
}
