---
name: close
description: Remove a git worktree and cleanup the registry
argument-hint: <worktree-name> [--force]
---

Remove a worktree and clean up the registry.

**Usage:**

```bash
/worktree/close <worktree-name> [--force]
```

**Arguments:**

- `worktree-name` (required) - Name of the worktree to close
- `--force` (optional) - Skip uncommitted changes check

**Examples:**

```bash
/worktree/close feat-new-api
/worktree/close feat-new-api --force
```

Use the Bash tool to execute:

```bash
/Users/romanmakovyak/workspace/monorepo-project-template/.claude/skills/worktree/scripts/close-worktree.sh "$ARGUMENTS"
```
