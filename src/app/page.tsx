"use client";

import dynamic from "next/dynamic";

/**
 * The canvas is a client surface that restores the last flow from the browser.
 * Rendering it on the server would paint a flow that is immediately replaced by
 * the saved one, so it is loaded straight in the browser instead.
 */
const Canvas = dynamic(
  () => import("@/components/Canvas").then((m) => m.Canvas),
  { ssr: false, loading: () => <div className="dotted h-screen w-full" /> },
);

export default function Home() {
  return <Canvas />;
}
