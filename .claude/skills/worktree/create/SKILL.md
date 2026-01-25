---
name: create
description: Create a new git worktree with automatic port allocation and environment setup
argument-hint: <branch-name> [worktree-name]
---

Create a new worktree from the specified branch with automatic environment setup.

**Usage:**

```bash
/worktree/create <branch-name> [worktree-name]
```

**Arguments:**

- `branch-name` (required) - Git branch to checkout in the worktree
- `worktree-name` (optional) - Custom name for the worktree directory

**Examples:**

```bash
/worktree/create feat/new-api
/worktree/create feat/new-api my-feature
```

Use the Bash tool to execute:

```bash
/Users/romanmakovyak/workspace/monorepo-project-template/.claude/skills/worktree/scripts/create-worktree.sh "$ARGUMENTS"
```
