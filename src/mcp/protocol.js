import { listToolDefs } from "./tool-defs.js";

export { listToolDefs };

export function resolveProjectPathFromEnv() {
  const raw = process.env.PROJECT_BRAIN_PATH;
  if (raw != null && String(raw).trim()) return String(raw).trim();
  return process.cwd();
}

export async function handleMcpRequest(body, session) {
  const method = body && body.method;
  const id = body && body.id;
  if (typeof method === "string" && method.startsWith("notifications/")) {
    return null;
  }
  if (method === "initialized") {
    return null;
  }
  if (method === "initialize") {
    return { jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "dsh-project-brain", version: "1.3.1" } } };
  }
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: listToolDefs() } };
  }
  if (method === "tools/call") {
    const name = body.params && body.params.name;
    const args = (body.params && (body.params.arguments || body.params.args)) || {};
    const result = await session.dispatch(name, args);
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: !result || result.ok === false,
      },
    };
  }
  if (id === undefined) {
    return null;
  }
  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }
  return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found: " + method } };
}

function writeFramed(stdout, obj, headerMode) {
  if (!obj) return;
  const json = JSON.stringify(obj);
  if (headerMode) {
    const len = Buffer.byteLength(json, "utf8");
    stdout.write("Content-Length: " + len + "\r\n\r\n" + json);
    return;
  }
  stdout.write(json + "\n");
}

async function handleRaw(text, session, stdout, headerMode) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return;
  let body;
  try {
    body = JSON.parse(trimmed);
  } catch (e) {
    writeFramed(stdout, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, headerMode);
    return;
  }
  try {
    const out = await handleMcpRequest(body, session);
    writeFramed(stdout, out, headerMode);
  } catch (e) {
    writeFramed(stdout, {
      jsonrpc: "2.0",
      id: body && body.id,
      error: { code: -32603, message: String((e && e.message) || e) },
    }, headerMode);
  }
}

function detectFraming(buf) {
  const peek = buf.toString("utf8");
  if (!peek) return null;
  if (/^Content-Length:\s*\d+/i.test(peek)) return "header";
  if (/^Content-Length:/i.test(peek)) return null;
  const lower = peek.toLowerCase();
  const prefix = "content-length:";
  if (prefix.startsWith(lower) && peek.indexOf("{") < 0 && peek.indexOf("\n") < 0) return null;
  return "line";
}

export function attachStdio(session, stdin, stdout) {
  let buf = Buffer.alloc(0);
  let mode = null;
  let lineCarry = "";
  let chain = Promise.resolve();

  function enqueue(text, headerMode) {
    chain = chain.then(() => handleRaw(text, session, stdout, headerMode)).catch(() => {});
  }

  function drainHeader() {
    while (true) {
      const sep = buf.indexOf("\r\n\r\n");
      if (sep < 0) return;
      const header = buf.slice(0, sep).toString("utf8");
      const m = header.match(/Content-Length:\s*(\d+)/i);
      if (!m) {
        buf = buf.slice(sep + 4);
        continue;
      }
      const len = Number(m[1]);
      const bodyStart = sep + 4;
      if (buf.length < bodyStart + len) return;
      const body = buf.slice(bodyStart, bodyStart + len).toString("utf8");
      buf = buf.slice(bodyStart + len);
      enqueue(body, true);
    }
  }

  function drainLines() {
    const text = lineCarry + buf.toString("utf8");
    buf = Buffer.alloc(0);
    const parts = text.split(/\r?\n/);
    lineCarry = parts.pop() || "";
    for (const line of parts) enqueue(line, false);
  }

  function onChunk(chunk) {
    const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    buf = Buffer.concat([buf, piece]);
    if (!mode) {
      mode = detectFraming(buf);
      if (!mode) return;
    }
    if (mode === "header") drainHeader();
    else drainLines();
  }

  stdin.on("data", onChunk);
  stdin.on("end", () => {
    if (!mode) mode = detectFraming(buf) || "line";
    if (mode === "header") {
      drainHeader();
      return;
    }
    drainLines();
    if (lineCarry.trim()) enqueue(lineCarry, false);
  });
}
