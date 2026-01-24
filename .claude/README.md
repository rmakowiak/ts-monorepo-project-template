# Claude Code Configuration

This directory contains Claude Code configuration for the monorepo.

## Hooks

Hooks automatically run commands after certain actions to maintain code quality:

### PostToolUse Hooks

After `Write` or `Edit` tool calls:

1. **Prettier formatting** - Automatically formats the modified file
2. **ESLint** - Runs linting across the workspace

These hooks run synchronously to ensure code is properly formatted and linted after changes.

## Skills

- **docs** (`/docs`) - Standards for writing concise documentation

Provides guidelines for creating user-focused READMEs and markdown documentation across the monorepo.

## Enabled Plugins

- **frontend-design** - Production-grade frontend design and components
- **feature-dev** - Guided feature development workflow
- **code-simplifier** - Simplify and improve code quality
- **typescript-lsp** - TypeScript language server integration
- **commit-commands** - Git commit, push, and PR workflows
- **pr-review-toolkit** - Comprehensive PR review tools

## Customizing Hooks

To modify hooks, edit `.claude/settings.json`. Available hook events:

- `PostToolUse` - After tool execution (Edit, Write, etc.)
- `PreToolUse` - Before tool execution
- `UserPromptSubmit` - When user sends a message
- `SessionStart` - At session start
- `SessionEnd` - At session end

Example hook structure:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "your-command-here",
            "statusMessage": "Running...",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```
