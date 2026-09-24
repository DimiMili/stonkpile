/**
 * Remote MCP endpoint (Model Context Protocol, Streamable HTTP transport).
 *
 * The stdio server in mcp/ still works, but it needs a clone, an install and a
 * hand-edited config file. This is the same tools over a URL, so anything that
 * speaks MCP can connect in one line and read the live index.
 *
 * Deliberately no MCP server framework: the stateless half of the transport is
 * plain JSON-RPC over POST, so writing it directly is both smaller and one
 * fewer dependency to trust.
 *
 * Note for later: x402 payment gating slots in here, at the transport, because
 * 402 is just a status code and two headers. Free for now on purpose.
 */

import { TOOLS, runTool } from "@/lib/mcp-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROTOCOL = "2025-06-18";
const SUPPORTED = new Set(["2025-06-18", "2025-03-26", "2024-11-05"]);

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, mcp-protocol-version, mcp-session-id, authorization",
  "Access-Control-Expose-Headers": "mcp-protocol-version, mcp-session-id",
};

type Id = string | number | null;

const ok = (id: Id, result: unknown) =>
  Response.json({ jsonrpc: "2.0", id, result }, { headers: CORS });

const err = (id: Id, code: number, message: string) =>
  Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { headers: CORS });

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET() {
  // No server-initiated stream. The spec lets a server decline the GET.
  return Response.json(
    {
      error: "This endpoint speaks MCP over POST.",
      hint: "Add it as a remote MCP server in any MCP client, or POST a JSON-RPC request here.",
      tools: TOOLS.map((t) => t.name),
      docs: "https://modelcontextprotocol.io",
    },
    { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } },
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err(null, -32700, "Parse error");
  }

  // Batches are legal in JSON-RPC. Handle them rather than failing oddly.
  if (Array.isArray(body)) {
    const out = await Promise.all(body.map(handle));
    const replies = out.filter((r) => r !== null);
    if (!replies.length) return new Response(null, { status: 202, headers: CORS });
    return Response.json(replies, { headers: CORS });
  }

  const reply = await handle(body);
  // A notification gets no response body, only an acknowledgement.
  if (reply === null) return new Response(null, { status: 202, headers: CORS });
  return Response.json(reply, { headers: CORS });
}

interface Rpc {
  jsonrpc?: string;
  id?: Id;
  method?: string;
  params?: Record<string, unknown>;
}

async function handle(raw: unknown): Promise<object | null> {
  const msg = (raw ?? {}) as Rpc;
  const id: Id = msg.id ?? null;
  const isNotification = msg.id === undefined;
  const p = msg.params ?? {};

  const reply = (result: unknown) => (isNotification ? null : { jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) =>
    isNotification ? null : { jsonrpc: "2.0", id, error: { code, message } };

  switch (msg.method) {
    case "initialize": {
      const asked = typeof p.protocolVersion === "string" ? p.protocolVersion : "";
      return reply({
        protocolVersion: SUPPORTED.has(asked) ? asked : PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "stonkpile", version: "0.2.0" },
        instructions:
          "Live index of every tokenized stock on Solana and every coin quoted against one. " +
          "Use check_stock before trusting any ticker: issuers are verified by token metadata " +
          "host, so lookalikes do not pass. Data refreshes every 5 minutes.",
      });
    }

    case "notifications/initialized":
    case "notifications/cancelled":
      return null;

    case "ping":
      return reply({});

    case "tools/list":
      return reply({
        tools: TOOLS.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });

    case "tools/call": {
      const name = typeof p.name === "string" ? p.name : "";
      const args = (p.arguments ?? {}) as Record<string, unknown>;
      if (!TOOLS.some((t) => t.name === name)) return fail(-32602, `Unknown tool: ${name}`);
      try {
        const text = await runTool(name, args);
        return reply({ content: [{ type: "text", text }] });
      } catch (e) {
        // Tool errors belong in the result, not the JSON-RPC error channel, so
        // the model can see what went wrong and try something else.
        return reply({
          content: [{ type: "text", text: `Tool failed: ${(e as Error).message}` }],
          isError: true,
        });
      }
    }

    default:
      return fail(-32601, `Method not found: ${msg.method ?? "(none)"}`);
  }
}
