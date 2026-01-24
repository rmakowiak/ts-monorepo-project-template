---
name: docs
description: Standards for writing concise, user-focused documentation (READMEs and markdown files)
---

# Documentation Standards

Use this skill when creating or updating any documentation file (README.md, CONFIG.md, API.md, GUIDES.md, etc.).

## Philosophy

**Human-readable over comprehensive**

Documentation should help users accomplish tasks quickly, not explain every detail.

Key principles:

- **Short and scannable** - Most docs should be 50-300 lines
- **User-focused** - How to use it, not how it works
- **Minimal code examples** - 1-5 lines max, only when necessary
- **Action-oriented** - Commands to run, not explanations
- **Hierarchical** - Most important information first

## Documentation Types

### README.md Files

**Purpose**: Quick orientation and getting started

**Target length**: 50-150 lines

**Essential sections**:

- Title and one-sentence description
- Quick Start (3-5 commands)
- What It Does (2-3 sentences)
- Key features or endpoints
- Links to detailed docs
- Essential commands only

**Template**:

````markdown
# Package/Service Name

One-sentence description of what this does.

## Quick Start

```bash
# Install and run
pnpm install
pnpm dev
```
````

## What It Does

2-3 sentences explaining the core purpose and value.

## Key Features

- Feature 1
- Feature 2
- Feature 3

## Configuration

See [CONFIG.md](./CONFIG.md) for configuration options.

## Architecture

See [CLAUDE.md](./CLAUDE.md) for architectural details.

## Commands

- `pnpm dev` - Start development
- `pnpm build` - Build for production
- `pnpm test` - Run tests

````

### Configuration Guides (CONFIG.md)

**Purpose**: Document configuration options and environment variables

**Target length**: 100-250 lines

**Essential sections**:
- Quick reference table or list
- Environment file structure
- Usage examples (minimal)
- Link to detailed architecture

**Best practices**:
- Use tables for variable reference
- Group related config together
- Show only essential examples
- Link to CLAUDE.md for implementation details

### Feature Guides (HOOKS_GUIDE.md, API.md, etc.)

**Purpose**: Document specific features or workflows

**Target length**: 100-300 lines

**Essential sections**:
- What the feature does (2-3 sentences)
- How to use it (commands or examples)
- Configuration or customization
- Common use cases
- Troubleshooting (only common issues)

**Best practices**:
- Start with most common use case
- Use bullet points over paragraphs
- Show complete working examples
- Link to related documentation

### CLAUDE.md Files (Exception)

**Purpose**: Comprehensive architectural documentation for AI agents

**Target length**: 1000+ lines (this is the ONE verbose doc)

**Essential sections**:
- Architecture overview with diagrams
- Project structure with explanations
- Core concepts and patterns
- Module structure and conventions
- Implementation examples
- Best practices and anti-patterns
- Testing strategy
- How to extend the codebase

**When to create CLAUDE.md**:
- For services with complex architecture
- For packages that establish patterns
- When clean architecture or specific patterns are used
- To guide AI agents in maintaining consistency

**This is the ONLY document type that should be verbose.**

## Writing Guidelines

### ✅ DO

- Start with the most important information
- Use bullet points and lists
- Keep paragraphs to 1-3 sentences
- Use active voice ("Run tests" not "Tests can be run")
- Show working commands users can copy/paste
- Link to other docs instead of duplicating
- Use clear, simple language
- Include only essential examples
- Group related information together
- Use headers to make content scannable

### ❌ DON'T

- Write long explanatory paragraphs
- Duplicate information across docs
- Include comprehensive tutorials (link to them instead)
- Explain basic concepts users should already know
- Show every possible option or flag
- Include extensive code examples
- Write "Introduction" or "Overview" sections that repeat the title
- Use passive voice or complex sentences
- Add fluff or marketing language

## Code Examples

Keep code examples minimal and focused:

**✅ Good example** (2-3 lines):
```bash
pnpm dev
curl http://localhost:8000/health
````

**❌ Too verbose** (showing entire implementation):

```typescript
// Don't show full implementations in READMEs
async function createUser(data: CreateUserDto): Promise<User> {
  const user = await this.repository.save(data);
  await this.emailService.sendWelcome(user.email);
  return user;
}
```

**When to show code**:

- Essential commands to run
- Minimal configuration examples
- API endpoint format
- Critical usage patterns

**When NOT to show code**:

- Implementation details (put in CLAUDE.md)
- Full class/function definitions
- Multiple ways to do the same thing
- Framework boilerplate

## Structure Patterns

### Hierarchical Information

Most important → Least important:

1. **What it is** (one sentence)
2. **Quick start** (get running in 30 seconds)
3. **Core features** (bullet points)
4. **Essential commands** (what users will run daily)
5. **Links to deeper docs** (for those who need more)

### Linking Strategy

**Create a documentation tree**:

```
README.md (50-150 lines)
├── CONFIG.md (100-250 lines)
├── API.md (100-300 lines)
└── CLAUDE.md (1000+ lines - comprehensive architecture)
```

**In README**, link to detailed docs:

```markdown
## Configuration

See [CONFIG.md](./CONFIG.md) for environment variables and settings.

## Architecture

See [CLAUDE.md](./CLAUDE.md) for architectural details and patterns.
```

## Real Examples from This Repo

### ✅ Excellent: Root README.md

**Length**: 72 lines
**Why it's good**:

- Starts with quick start commands
- Shows structure visually
- Lists features as bullets
- No unnecessary explanation
- Links are minimal and clear

### ✅ Excellent: HOOKS_GUIDE.md

**Length**: 101 lines
**Why it's good**:

- Explains what hooks do in 2 sentences
- Shows configuration clearly
- Practical examples only
- Clear benefits list
- Testing and customization sections are concise

### ✅ Appropriate: example-service CLAUDE.md

**Length**: 1409 lines
**Why it's appropriate**:

- This is architectural documentation (exception to brevity)
- Explains clean architecture comprehensively
- Shows implementation patterns
- Guides maintainers and AI agents
- Only type of doc that should be this long

## When NOT to Follow These Rules

These standards apply to **human-readable documentation**. Don't apply them to:

- **CLAUDE.md files** - These should be comprehensive (1000+ lines)
- **API specifications** - Auto-generated, machine-readable
- **Legal documents** - LICENSE, CONTRIBUTING.md require specific wording
- **Changelogs** - CHANGELOG.md follows keep-a-changelog format
- **Auto-generated docs** - TypeDoc, JSDoc output, OpenAPI specs

## Checklist for Documentation Review

Before finalizing any documentation, verify:

- [ ] Title and description are clear and concise
- [ ] Most important information is first
- [ ] Quick start commands are present and working
- [ ] Code examples are minimal (1-5 lines each)
- [ ] No duplicate information
- [ ] Links to detailed docs instead of embedding
- [ ] Total length is appropriate for doc type
- [ ] Active voice and clear language used
- [ ] Scannable with bullet points and headers
- [ ] No unnecessary explanations or fluff

## Common Mistakes to Avoid

### Mistake 1: Writing a Tutorial in README

**❌ Bad**:

```markdown
# Getting Started

First, let's understand what this service does. It provides a REST API
for managing products. To get started, you'll need to set up your
environment. Begin by installing Node.js if you haven't already...
```

**✅ Good**:

````markdown
# Product Service

REST API for product management.

## Quick Start

```bash
pnpm install
pnpm dev
```
````

````

### Mistake 2: Showing Every Option

**❌ Bad**:
```markdown
## Commands

- `pnpm dev` - Start development server
- `pnpm dev:watch` - Start development with watch mode
- `pnpm dev:debug` - Start development with debugging
- `pnpm dev:inspect` - Start development with Node inspector
- `pnpm build` - Build for production
- `pnpm build:watch` - Build with watch mode
- `pnpm build:analyze` - Build with bundle analyzer
````

**✅ Good**:

```markdown
## Commands

- `pnpm dev` - Start development
- `pnpm build` - Build for production
- `pnpm test` - Run tests
```

### Mistake 3: Duplicating Content

**❌ Bad**: Repeating configuration details in both README.md and CONFIG.md

**✅ Good**: Brief mention in README with link to CONFIG.md:

```markdown
## Configuration

Environment variables: `PORT`, `NODE_ENV`, `JWT_SECRET`

See [CONFIG.md](./CONFIG.md) for details.
```

### Mistake 4: Explaining Instead of Showing

**❌ Bad**:

```markdown
To create a new product, you need to send a POST request to the
/products endpoint. The request should include a JSON body with
the product details. Make sure you include the authentication
token in the Authorization header.
```

**✅ Good**:

````markdown
## Create Product

```bash
curl -X POST http://localhost:8000/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Widget","price":9.99}'
```
````

```

## Summary

**For most documentation**:
- Short (50-300 lines)
- Focused on usage
- Minimal examples
- Links to detailed docs

**For CLAUDE.md only**:
- Comprehensive (1000+ lines)
- Architectural details
- Implementation patterns
- Deep technical content

**Always**:
- User-focused
- Scannable
- Action-oriented
- Clear and concise

Use this skill whenever creating or updating markdown documentation to maintain consistency across the monorepo.
```
