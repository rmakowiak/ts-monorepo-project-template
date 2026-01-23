# Claude Code Hooks Setup

This repository has Claude Code hooks configured to maintain code quality automatically.

## What Hooks Do

Hooks are shell commands that run automatically in response to events during Claude Code sessions. They help enforce code standards without manual intervention.

## Configured Hooks

### 1. Prettier Formatting (PostToolUse)

**When it runs:** After any `Write` or `Edit` tool call
**What it does:** Automatically formats the modified file with Prettier
**Command:** `pnpm style:format -- {{file}}`
**Timeout:** 10 seconds

### 2. ESLint Linting (PostToolUse)

**When it runs:** After any `Write` or `Edit` tool call
**What it does:** Runs ESLint across the entire workspace
**Command:** `pnpm lint`
**Timeout:** 15 seconds

## How They Work

When Claude edits or writes a file:

1. **File is saved** → `Write` or `Edit` tool completes
2. **Prettier runs** → Formats the file (async)
3. **ESLint runs** → Lints the entire workspace (async)
4. **Status messages** → Shows progress in Claude Code UI

Both hooks use `|| true` to prevent failures from blocking Claude's workflow.

## Benefits

- **Consistent formatting** - All code follows the same style automatically
- **Early error detection** - Lint errors caught immediately
- **No manual formatting** - Claude's changes are always properly formatted
- **Fast feedback** - See linting issues right after changes

## Testing Hooks

You can verify hooks are working by checking the Claude Code status messages after file edits. You should see:

- "Formatting with Prettier..."
- "Running ESLint..."

## Disabling Hooks

To temporarily disable hooks, add to `.claude/settings.local.json`:

```json
{
  "disableAllHooks": true
}
```

## Adding More Hooks

Want to add tests or other checks? Edit `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "pnpm test",
            "statusMessage": "Running tests...",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

## Available Hook Events

- `PostToolUse` - After tool execution
- `PreToolUse` - Before tool execution
- `UserPromptSubmit` - When user sends a message
- `SessionStart` - At session start
- `SessionEnd` - At session end
- `SubagentStart` - When subagent starts
- `SubagentStop` - When subagent stops

## Hook Types

- **command** - Run a shell command
- **prompt** - Run an LLM prompt
- **agent** - Run an agentic verifier

For this monorepo, we use simple command hooks for maximum reliability.
