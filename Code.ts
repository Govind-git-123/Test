// config.ts
// Centralized environment variable access and validation

import dotenv from "dotenv";
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  serviceNow: {
    username: requireEnv("SERVICENOW_USERNAME"),
    password: requireEnv("SERVICENOW_PASSWORD"),
    instance: process.env.SERVICENOW_INSTANCE || "https://accentureabdemo2.service-now.com",
  },
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
};


--------------------------------------------

import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const server = new McpServer({
  name: "mcp-streamable-http",
  version: "1.0.0",
});


import { config } from "./config.js";
// ServiceNow API configuration
const SERVICENOW_INSTANCE = config.serviceNow.instance;

// Helper for ServiceNow API requests
async function serviceNowRequest(
  path: string,
  query: Record<string, string> = {},
  username: string,
  password: string
) {
  const url = new URL(`${SERVICENOW_INSTANCE}${path}`);
  Object.entries(query).forEach(([k, v]) => url.searchParams.append(k, v));
  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization":
        "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
    },
  });
  if (!response.ok) {
    throw new Error(`ServiceNow API error: ${response.status}`);
  }
  return response.json();
}

// Tool: List Incidents
const listIncidents = server.tool(
  "list-incidents",
  "List ServiceNow incidents",
  {},
  async () => {
    const username = config.serviceNow.username;
    const password = config.serviceNow.password;
    const data = await serviceNowRequest(
      "/api/now/table/incident",
      { sysparm_limit: "5" },
      username,
      password
    );
    return {
      content: [
        {
          type: "text",
          text: data.result.map((i: any) => `${i.number}: ${i.short_description}`).join("\n"),
        },
      ],
    };
  }
);

// Tool: Get Incident by Number
const getIncidentByNumber = server.tool(
  "get-incident-by-number",
  "Get a ServiceNow incident by number",
  {
    number: z.string().describe("Incident number, e.g. INC0010001"),
  },
  async (params: { number: string }) => {
    const username = config.serviceNow.username;
    const password = config.serviceNow.password;
    const data = await serviceNowRequest(
      "/api/now/table/incident",
      {
        number: params.number,
        sysparm_limit: "1",
      },
      username,
      password
    );
    if (!data.result.length) {
      return { content: [{ type: "text", text: "Incident not found." }] };
    }
    const inc = data.result[0];
    return {
      content: [
        {
          type: "text",
          text: `Number: ${inc.number}\nShort Description: ${inc.short_description}\nState: ${inc.state}`,
        },
      ],
    };
  }
);

// Tool: Search Knowledge Articles
const searchKnowledge = server.tool(
  "search-knowledge",
  "Search ServiceNow knowledge articles by keyword",
  {
    keyword: z.string().describe("Keyword to search in knowledge articles"),
  },
  async (params: { keyword: string }) => {
    const username = config.serviceNow.username;
    const password = config.serviceNow.password;
    const data = await serviceNowRequest(
      "/api/now/table/kb_knowledge",
      {
        text: params.keyword,
        sysparm_limit: "5",
      },
      username,
      password
    );
    if (!data.result.length) {
      return { content: [{ type: "text", text: "No articles found." }] };
    }
    return {
      content: [
        {
          type: "text",
          text: data.result.map((a: any) => `${a.number || a.sys_id}: ${a.short_description}`).join("\n"),
        },
      ],
    };
  }
);

const app = express();
app.use(express.json());

const transport: StreamableHTTPServerTransport =
  new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // set to undefined for stateless servers
  });

// Setup routes for the server
const setupServer = async () => {
  await server.connect(transport);
};

app.post("/mcp", async (req: Request, res: Response) => {
  console.log("Received MCP request:", req.body);
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req: Request, res: Response) => {
  console.log("Received GET MCP request");
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    })
  );
});

app.delete("/mcp", async (req: Request, res: Response) => {
  console.log("Received DELETE MCP request");
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    })
  );
});

// Start the server
const PORT = process.env.PORT || 3000;
setupServer()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`MCP Streamable HTTP Server listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to set up the server:", error);
    process.exit(1);
  });
console.log(process.env.SERVICENOW_USERNAME + "dcdsc");
console.log(process.env.SERVICENOW_PASSWORD);
console.log(process.env.SERVICENOW_INSTANCE);
