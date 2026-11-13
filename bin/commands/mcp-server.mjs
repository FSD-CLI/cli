import { inspectProject } from "./inspect-project.mjs";
import { explainProject } from "./explain-project.mjs";

// Minimal MCP server over stdio (PLAT-02, scoped): hand-rolled JSON-RPC 2.0,
// newline-delimited, with exactly two tools — `check` and `explain` — that
// reuse the CLI's own inspect/explain helpers. No dependencies, no HTTP,
// no generation: the server only reads the project it is pointed at.

export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const MCP_SERVER_NAME = "fsd-cli";

const PROJECT_PATH_SCHEMA = {
  type: "object",
  properties: {
    projectPath: {
      type: "string",
      description:
        "Path to the project root. Defaults to the server's working directory.",
    },
  },
  additionalProperties: false,
};

export const MCP_TOOLS = [
  {
    name: "check",
    description:
      "Inspect an FSD project: configuration, package.json and the required layers (app, pages, widgets, features, entities, shared).",
    inputSchema: PROJECT_PATH_SCHEMA,
  },
  {
    name: "explain",
    description:
      "Summarize an FSD project: framework, stack and slice counts per layer.",
    inputSchema: PROJECT_PATH_SCHEMA,
  },
];

class JsonRpcError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function resolveProjectPath(args) {
  if (args === undefined) return process.cwd();
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    throw new JsonRpcError(-32602, "Invalid params: arguments must be an object.");
  }
  if (args.projectPath !== undefined && typeof args.projectPath !== "string") {
    throw new JsonRpcError(-32602, "Invalid params: projectPath must be a string.");
  }
  return args.projectPath ?? process.cwd();
}

function runCheck(args) {
  const cwd = resolveProjectPath(args);
  const { config, checks } = inspectProject(cwd);
  return {
    passed: checks.every((check) => check.ok),
    config: config ?? null,
    checks,
  };
}

function runExplain(args) {
  const cwd = resolveProjectPath(args);
  const { config, layers, total } = explainProject(cwd);
  return {
    framework: config.framework,
    packageManager: config.packageManager,
    apiClient: config.apiClient,
    serverState: config.serverState,
    clientState: config.clientState,
    forms: config.forms,
    layers,
    total,
  };
}

function toolResult(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function toolError(message) {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

function handleRequest(message, version) {
  const { id, method, params } = message;

  if (method === "initialize") {
    return {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: MCP_SERVER_NAME, version },
    };
  }
  if (method === "ping") return {};
  if (method === "tools/list") return { tools: MCP_TOOLS };
  if (method === "tools/call") {
    if (!params || typeof params !== "object" || typeof params.name !== "string") {
      throw new JsonRpcError(-32602, "Invalid params: tools/call requires a tool name.");
    }
    if (params.name === "check" || params.name === "explain") {
      try {
        return toolResult(
          params.name === "check" ? runCheck(params.arguments) : runExplain(params.arguments),
        );
      } catch (error) {
        return toolError(error.message);
      }
    }
    throw new JsonRpcError(-32602, `Invalid params: unknown tool "${params.name}".`);
  }
  throw new JsonRpcError(-32601, `Method not found: ${method}`);
}

function handleLine(line, version, send) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }
  if (typeof message !== "object" || message === null || Array.isArray(message)) {
    send({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid Request" },
    });
    return;
  }
  // Notifications (no id) get no response.
  if (message.id === undefined) return;
  if (typeof message.method !== "string") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32600, message: "Invalid Request" },
    });
    return;
  }
  try {
    send({ jsonrpc: "2.0", id: message.id, result: handleRequest(message, version) });
  } catch (error) {
    if (error instanceof JsonRpcError) {
      send({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: error.code, message: error.message },
      });
      return;
    }
    send({
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32603, message: error.message },
    });
  }
}

export function runMcpServer({
  version = "0.0.0",
  input = process.stdin,
  output = process.stdout,
} = {}) {
  const send = (payload) => output.write(`${JSON.stringify(payload)}\n`);
  let buffer = "";
  input.setEncoding("utf8");
  return new Promise((resolve) => {
    input.on("data", (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line) handleLine(line, version, send);
      }
    });
    input.on("end", () => {
      if (buffer.trim()) handleLine(buffer.trim(), version, send);
      resolve();
    });
  });
}
