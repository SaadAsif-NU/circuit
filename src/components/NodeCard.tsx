"use client";

import { motion } from "framer-motion";
import { GitMerge, Search, Sparkles, Terminal, Type, X } from "lucide-react";

import { cn } from "@/lib/cn";
import type { FlowNode, NodeKind } from "@/lib/graph";
import { NODE_W, PORT_GAP, PORT_TOP } from "@/lib/layout";
import type { NodeDefinition } from "@/lib/nodes";
import type { NodeStatus } from "@/lib/useRun";

const ICONS: Record<NodeKind, typeof Type> = {
  input: Type,
  llm: Sparkles,
  search: Search,
  join: GitMerge,
  output: Terminal,
};

const STATUS_RING: Record<NodeStatus, string> = {
  idle: "border-line",
  running: "border-live ring-running",
  done: "border-done/60",
  failed: "border-fail/70",
  skipped: "border-line opacity-50",
};

export function NodeCard({
  node,
  def,
  status,
  text,
  selected,
  onPointerDownHeader,
  onConfigChange,
  onOutputDown,
  onInputUp,
  onDelete,
}: {
  node: FlowNode;
  def: NodeDefinition;
  status: NodeStatus;
  text: string;
  selected: boolean;
  onPointerDownHeader: (e: React.PointerEvent) => void;
  onConfigChange: (key: string, value: string) => void;
  onOutputDown: (e: React.PointerEvent) => void;
  onInputUp: (port: string) => void;
  onDelete: () => void;
}) {
  const Icon = ICONS[node.kind];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "glass group absolute rounded-xl border transition-colors",
        STATUS_RING[status],
        selected && "border-primary/70",
      )}
      style={{ left: node.x, top: node.y, width: NODE_W }}
    >
      {/* header: the drag handle */}
      <div
        onPointerDown={onPointerDownHeader}
        className="flex cursor-grab items-center gap-2 rounded-t-xl border-b border-line px-3 py-2 active:cursor-grabbing"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-circuit text-white">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1 truncate text-sm font-medium">{def.label}</span>
        {status === "running" && (
          <span className="text-[10px] text-live">running</span>
        )}
        {status === "done" && (
          <span className="text-[10px] text-done">done</span>
        )}
        {status === "failed" && (
          <span className="text-[10px] text-fail">failed</span>
        )}
        {status === "skipped" && (
          <span className="text-[10px] text-muted">skipped</span>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDelete}
          aria-label={`Delete ${def.label} node`}
          className="rounded p-0.5 text-muted opacity-0 transition group-hover:opacity-100 hover:text-text focus-visible:opacity-100 focus-visible:outline-none"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* One row per input. The rows reserve the vertical space the ports sit
          in, so a wire never lands on top of a text field. */}
      {def.inputs.map((port, i) => (
        <div
          key={port}
          className="flex items-center px-3"
          style={{ height: PORT_GAP }}
        >
          <span className="pointer-events-none text-[10px] text-muted">
            {port}
          </span>
          <button
            onPointerUp={() => onInputUp(port)}
            aria-label={`Input ${port}`}
            className="absolute h-3.5 w-3.5 rounded-full border-2 border-wire bg-node transition hover:border-accent hover:bg-accent/30"
            style={{ left: -7, top: PORT_TOP + i * PORT_GAP - 7 }}
          />
        </div>
      ))}

      {/* output port */}
      {def.hasOutput && (
        <button
          onPointerDown={onOutputDown}
          aria-label="Output"
          className="absolute h-3.5 w-3.5 cursor-crosshair rounded-full border-2 border-wire bg-node transition hover:border-accent hover:bg-accent/30"
          style={{ left: NODE_W - 7, top: PORT_TOP - 7 }}
        />
      )}

      <div className="space-y-2 px-3 pb-3 pt-2">
        {def.fields.map((field) =>
          field.multiline ? (
            <textarea
              key={field.key}
              value={node.config[field.key] ?? ""}
              onChange={(e) => onConfigChange(field.key, e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder={field.placeholder}
              rows={3}
              className="w-full resize-none rounded-md border border-line bg-base/60 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-text outline-none placeholder:text-muted/60 focus:border-primary/60"
            />
          ) : (
            <input
              key={field.key}
              value={node.config[field.key] ?? ""}
              onChange={(e) => onConfigChange(field.key, e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder={field.placeholder}
              className="w-full rounded-md border border-line bg-base/60 px-2 py-1.5 font-mono text-[11px] text-text outline-none placeholder:text-muted/60 focus:border-primary/60"
            />
          ),
        )}

        {def.fields.length === 0 && (
          <p className="text-[11px] leading-relaxed text-muted">
            {def.description}
          </p>
        )}

        {/* Whatever this node has produced so far. An input node's output is
            just the text already in its field, so echoing it would be noise. */}
        {text && node.kind !== "input" && (
          <div className="max-h-28 overflow-auto rounded-md border border-line bg-base/60 px-2 py-1.5">
            <p
              className={cn(
                "whitespace-pre-wrap font-mono text-[11px] leading-relaxed",
                status === "failed" ? "text-fail" : "text-muted",
              )}
            >
              {text}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
