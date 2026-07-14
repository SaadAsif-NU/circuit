"use client";

import { bezierPath, type Point } from "@/lib/layout";

/**
 * One connection. When data is flowing through it the dash marches from source
 * to target, which is the clearest way to show a graph executing.
 */
export function Wire({
  from,
  to,
  active,
  done,
  onCut,
}: {
  from: Point;
  to: Point;
  active?: boolean;
  done?: boolean;
  onCut?: () => void;
}) {
  const d = bezierPath(from, to);
  const stroke = active
    ? "var(--color-live)"
    : done
      ? "var(--color-done)"
      : "var(--color-wire)";

  return (
    <g>
      {/* A fat invisible stroke so the wire is easy to click. */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{
          pointerEvents: onCut ? "stroke" : "none",
          cursor: onCut ? "pointer" : "default",
        }}
        onClick={onCut}
      >
        {onCut && <title>Click to disconnect</title>}
      </path>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={active ? 2.5 : 2}
        strokeLinecap="round"
        className={active ? "wire-live" : undefined}
        style={{ pointerEvents: "none", transition: "stroke 0.3s ease" }}
      />
    </g>
  );
}

/** The wire that follows the cursor while you are dragging a connection. */
export function GhostWire({ from, to }: { from: Point; to: Point }) {
  return (
    <path
      d={bezierPath(from, to)}
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth={2}
      strokeDasharray="4 4"
      strokeLinecap="round"
      style={{ pointerEvents: "none" }}
    />
  );
}
