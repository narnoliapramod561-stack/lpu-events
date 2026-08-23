# Codebase Memory MCP Documentation

This document explains the configuration, usage, and guidelines for the Codebase Memory Model Context Protocol (MCP) server integrated into this project.

## Purpose

The Codebase Memory MCP is added to improve AI coding agents' (such as Antigravity/Gemini) understanding of the existing codebase across development sessions. 
It provides the agent with persistent structural context, including:
1. Understanding the monorepo structure.
2. Understanding module relationships.
3. Remembering key architectural invariants and design decisions.
4. Reducing repeated repository exploration cycles.

> [!IMPORTANT]
> The Codebase Memory MCP is **NOT** a replacement for the project's canonical Markdown documentation in `docs/technical/`.

---

## Source-of-Truth Hierarchy

When developing or analyzing the codebase, the following hierarchy of authority must be followed:

1. **Approved Product Requirements / PRDs**
2. **Canonical Technical Documentation** (`docs/technical/*.md`)
3. **Database Migrations** (`supabase/migrations/`)
4. **Actual Implementation / Code**
5. **Codebase Memory MCP**

If a conflict is detected between memory and canonical documentation, the **documentation wins**.
If a conflict is detected between documentation and actual implementation, developers/AI agents must **STOP and report the inconsistency** rather than silently deciding which one is correct.

---

## MCP Server Selection and Configuration

We use the official **Model Context Protocol Memory Server** (`@modelcontextprotocol/server-memory`) maintained by the Model Context Protocol ecosystem.

### Why Selected
1. **Local-first**: Data is stored entirely locally on the developer's machine in a simple JSONL file, ensuring privacy.
2. **Standard-compliant**: Out-of-the-box support for MCP-compliant AI editors and language servers.
3. **Cross-platform**: Written in TypeScript and runs via standard Node/npm (`npx`), operating identically on both macOS and Windows.

### Configuration Path
The server is configured as a workspace-level plugin:
- Manifest: `.agents/plugins/codebase-memory/plugin.json`
- Server Config: `.agents/plugins/codebase-memory/mcp_config.json`

### `mcp_config.json` Configuration
```json
{
  "mcpServers": {
    "codebase-memory": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-memory"
      ],
      "env": {
        "MEMORY_FILE_PATH": ".agents/plugins/codebase-memory/memory.jsonl"
      }
    }
  }
}
```

---

## State and Persistence

The persistent knowledge graph of codebase memories is stored in:
`.agents/plugins/codebase-memory/memory.jsonl`

### Git Safety and Exclusions
To ensure security and cleanliness:
- **`memory.jsonl` is listed in `.gitignore`** and must never be committed to Git.
- Each developer maintains their local memory database state.
- Seed memory has been initialized with the core architectural invariants.

### Excluded Data (Strict Security Rules)
AI agents must **NEVER** write or persist secrets to the memory database. The following files, paths, and patterns must be explicitly excluded from memory indexing or storage:
- Environment variables/files (`.env`, `.env.*`)
- Private keys and certificates (`*.pem`, `*.key`)
- API credentials, service-role keys, and tokens
- Third-party logins or provider credentials
- Local database credentials/passwords
- Large directories/build artifacts (`node_modules/`, `dist/`, `build/`, `coverage/`)
- Temporary/OS-specific files (`.DS_Store`, `Thumbs.db`)

### Database Memory Invariants
Database migrations are authoritative. AI agents must **never**:
1. Automatically create migration files without developer review.
2. Silently modify migration files.
3. Rewrite migration history.
4. Delete migrations or change production schemas automatically.

---

## How to Use Codebase Memory

The memory server exposes the following MCP tools to the AI assistant:
- `create_entities`: Declare nodes (e.g. apps, databases, rules).
- `create_relations`: Create directed connections between nodes (e.g., depends_on, implements).
- `add_observations`: Add specific facts/details to nodes.
- `search_nodes`: Search the memory graph using queries.
- `read_graph`: View all nodes and relationships.

### Updating Memory on Code Changes
When code changes:
1. AI agents should identify affected modules and components.
2. If documented architectural decisions change, **update the canonical Markdown docs first**, and then update the codebase memory to align with the new documents.
3. Ensure stale memory is deleted or updated to avoid conflicting assumptions.

---

## Rebuilding and Troubleshooting

### How to Rebuild/Re-index Memory
If local memory becomes corrupt or out-of-sync:
1. Delete the local `.agents/plugins/codebase-memory/memory.jsonl` file.
2. Run the MCP server to recreate the file, or copy the original seed invariants.
3. The AI agent will rebuild the knowledge graph as it re-explores the codebase.

### Troubleshooting
If the memory server fails to start or tools are missing:
1. Verify Node.js and npm are installed and in the environment path (`node -v`, `npm -v`).
2. Run `npx -y @modelcontextprotocol/server-memory` manually in the terminal to verify the package is fetched and runs correctly.
3. Check the IDE's MCP Server logs (under `Additional Options (...) > MCP Servers` in the Antigravity IDE UI) to inspect status, errors, and standard output.
4. Ensure the path `.agents/plugins/codebase-memory/` exists and has proper write permissions.
