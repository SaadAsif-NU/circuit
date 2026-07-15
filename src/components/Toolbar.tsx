"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  GitMerge,
  Maximize2,
  Play,
  Search,
  Sparkles,
  Split,
  Square,
  Terminal,
  Type,
  Upload,
  WrapText,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { NodeKind } from "@/lib/graph";
import { PRESETS, type Preset } from "@/lib/presets";

const PALETTE: Array<{ kind: NodeKind; label: string; icon: typeof Type }> = [
  { kind: "input", label: "Input", icon: Type },
  { kind: "llm", label: "Model", icon: Sparkles },
  { kind: "search", label: "Search", icon: Search },
  { kind: "transform", label: "Text", icon: WrapText },
  { kind: "branch", label: "Branch", icon: Split },
  { kind: "join", label: "Join", icon: GitMerge },
  { kind: "output", label: "Output", icon: Terminal },
];

export function Toolbar({
  onAdd,
  onRun,
  onStop,
  onPreset,
  onImport,
  onExport,
  onFit,
  running,
  issue,
  ms,
}: {
  onAdd: (kind: NodeKind) => void;
  onRun: () => void;
  onStop: () => void;
  onPreset: (preset: Preset) => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onFit: () => void;
  running: boolean;
  issue?: string | null;
  ms: number | null;
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  // Close the menu on a click anywhere else, or on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

        {/* flows: open a preset, or move one in and out as JSON */}
        <div ref={menu} className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="menu"
            className="glass flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs text-muted transition hover:text-text focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
          >
            Flow
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              role="menu"
              className="glass absolute right-0 mt-2 w-64 rounded-xl p-1.5 shadow-2xl"
            >
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  role="menuitem"
                  onClick={() => {
                    onPreset(preset);
                    setOpen(false);
                  }}
                  className="w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
                >
                  <span className="block text-xs text-text">{preset.name}</span>
                  <span className="block text-[11px] leading-snug text-muted">
                    {preset.blurb}
                  </span>
                </button>
              ))}

              <div className="my-1.5 border-t border-line" />

              <button
                role="menuitem"
                onClick={() => {
                  picker.current?.click();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted transition hover:bg-white/5 hover:text-text focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
              >
                <Upload className="h-3.5 w-3.5" />
                Import JSON
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  onExport();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted transition hover:bg-white/5 hover:text-text focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
              >
                <Download className="h-3.5 w-3.5" />
                Export JSON
              </button>
            </motion.div>
          )}

          <input
            ref={picker}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              // Let the same file be picked twice in a row.
              e.target.value = "";
            }}
          />
        </div>

        <button
          onClick={onFit}
          className="glass rounded-xl p-2.5 text-muted transition hover:text-text focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
          title="Fit the flow on screen"
          aria-label="Fit the flow on screen"
        >
          <Maximize2 className="h-4 w-4" />
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
