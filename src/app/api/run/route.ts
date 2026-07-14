/**
 * POST /api/run
 *
 * Body: a Flow. Response: a text/event-stream of engine events.
 *
 * The graph is executed here, on the server, so the API key never reaches the
 * browser. Every event the engine emits (a node starting, a token, an edge
 * carrying data, a node finishing) is forwarded as it happens, which is what
 * lets the canvas animate a run live instead of waiting for a final payload.
 */

import { execute, validate } from "@/lib/engine";
import { parseFlow } from "@/lib/graph";

export const dynamic = "force-dynamic";

function frame(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const flow = parseFlow(body);
  if (!flow) {
    return Response.json(
      { error: "That is not a valid flow." },
      { status: 400 },
    );
  }

  const issues = validate(flow);
  if (issues.length > 0) {
    return Response.json({ error: issues[0].message, issues }, { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const safeEnqueue = (chunk: Uint8Array) => {
        if (open) {
          try {
            controller.enqueue(chunk);
          } catch {
            open = false; // the client hung up
          }
        }
      };
      try {
        await execute(
          flow,
          (event) => safeEnqueue(frame(event)),
          request.signal,
        );
      } catch (error) {
        safeEnqueue(
          frame({
            type: "run.completed",
            ms: 0,
            ok: false,
            error: error instanceof Error ? error.message : "Run failed.",
          }),
        );
      } finally {
        open = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
