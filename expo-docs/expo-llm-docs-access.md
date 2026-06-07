# Expo Docs for AI Agents & LLMs — access methods

> Efficient, low-token ways for agents/LLMs to consume Expo documentation.
> Saved 2026-06-04. Source: docs.expo.dev `/llms/`. Companion to the local
> `entire_expo_docs_6_4_2026.rtf` snapshot and the `expo` agent skills referenced
> in [../docs/ui-animation.md](../docs/ui-animation.md) (Design North Star).

## Quick start — pick by tool

| Method                  | Best for                                   | How                                                              |
| ----------------------- | ------------------------------------------ | --------------------------------------------------------------- |
| Per-page markdown       | Chat (Claude.ai, ChatGPT) + coding agents  | Append `/index.md` or `.md` to any docs page URL.               |
| "Copy Markdown" dropdown| Quick single-page prompts                  | On any docs page: **Copy page → Copy Markdown**.                |
| Section bundles         | Project rules / coding-agent config        | Add a `llms-*.txt` URL (or the index `/llms.txt`) to the tool.  |

## Per-page markdown

Every docs page has a lightweight markdown version — append `/index.md` **or** `.md`
to the page URL (both serve the same file). Use it to hand an agent one topic
without the full HTML. Example:

```text
https://docs.expo.dev/develop/development-builds/create-a-build/index.md
https://docs.expo.dev/develop/development-builds/create-a-build.md
```

## Documentation bundles (llms.txt initiative)

### Site-wide

| Endpoint         | Description                                                                  | Size    |
| ---------------- | ---------------------------------------------------------------------------- | ------- |
| `/llms.txt`      | Index of all available documentation files.                                  | ~100 kB |
| `/llms-full.txt` | Complete Expo docs (Router, Modules API, dev process, etc.).                 | ~1.9 MB |

### Section-wide

| Endpoint        | Description                                          | Size    |
| --------------- | ---------------------------------------------------- | ------- |
| `/llms-eas.txt` | Complete Expo Application Services (EAS) docs.        | ~1.0 MB |
| `/llms-sdk.txt` | Complete docs for the **latest** Expo SDK.            | ~2.8 MB |

### Deprecated SDK versions

- `/llms-sdk-v55.0.0.txt` — SDK 55
- `/llms-sdk-v54.0.0.txt` — SDK 54 ← **this project is on SDK 54**
- `/llms-sdk-v53.0.0.txt` — SDK 53
- `/llms-sdk-v52.0.0.txt` — SDK 52
- `/llms-sdk-v51.0.0.txt` — SDK 51

> ⚠️ Niyah is on **Expo SDK 54** (`expo@54.0.35`). `/llms-sdk.txt` tracks the
> *latest* SDK — for version-accurate APIs pin to **`/llms-sdk-v54.0.0.txt`**
> until we run the SDK upgrade (skill: `upgrading-expo`).

## Companion tooling

- **Expo MCP Server** (`docs.expo.dev/eas/ai/mcp`) — gives coding agents direct
  access to Expo + EAS services. (An `expo` MCP integration is present in this
  session: `mcp__plugin_expo_expo__*`.)
- **Expo Skills** — agent instruction files installed via the `expo` plugin; see
  the table in [../docs/ui-animation.md](../docs/ui-animation.md).
