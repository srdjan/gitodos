# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**gitodos** is a dual-purpose Deno TypeScript project:
1. **Inline issue tracker**: Scans code comments (TODO, BUG, FIXME, etc.) and generates reports
2. **Minimal HTTP server framework**: Production-ready server with functional programming patterns

## Technology Stack

- **Runtime**: Deno 1.41+
- **Language**: TypeScript with strict type checking
- **Architecture**: Light Functional Programming (no classes, Result types, pure functions)
- **Dependencies**: Minimal - only `@std/assert` from JSR

## Development Commands

### Server Development
```bash
deno task server:dev      # Run server with watch mode
deno task server:start    # Run production server
```

### Issue Tracking
```bash
deno task issues:scan          # Scan entire repository for issues
deno task issues:scan:src      # Scan src/ for TODO/BUG only
deno task issues:web           # Generate HTML dashboard
deno task issues:web:open      # Build and open dashboard (macOS)
deno task issues:hook:install  # Install git post-commit hook
```

### Testing & Quality
```bash
deno task test    # Run tests (currently minimal coverage)
deno fmt          # Format code
deno lint         # Lint code
```

## Architecture & Code Patterns

### Light Functional Programming Principles
- **NO classes or inheritance** - use types and pure functions
- **Result types for errors**: `Result<T,E>` pattern throughout
- **Immutable by default**: Use `readonly` and `ReadonlyArray`
- **Effects at edges**: Keep core logic pure, push I/O to boundaries
- **Port/Adapter pattern**: Abstract interfaces in `ports/`, implementations in `adapters/`

### Project Structure
```
src/
  adapters/   # Concrete implementations (ConsoleLogger, RealClock)
  http/       # HTTP layer (router, middleware, handlers)
  lib/        # Utilities (Result type, helpers)
  ports/      # Abstract interfaces (Logger, Clock)
  main.ts     # Server entry point

.git-bin/     # Issue tracking tools and generated files
  git-issues.ts    # Scanner implementation
  issues-web.ts    # HTML generator
  .issues          # Generated: all repo issues
  .bugs            # Generated: src/ TODO/BUG only
  issues.html      # Generated: dashboard
```

### Key Architectural Patterns

1. **Middleware Composition**: Functional middleware pipeline for cross-cutting concerns
2. **Result Types**: No exceptions in core logic - errors as values
3. **Dependency Injection**: Via ports/adapters, not classes
4. **Type-First Development**: Model with types, make illegal states unrepresentable

### HTTP Server Components

- **Router**: Simple method/path matching with type-safe handlers
- **Middleware**: Composable request/response transformers (CORS, logging, security)
- **Handlers**: Pure functions returning `Result<Response, HandlerError>`
- **Error Handling**: Structured error responses with proper status codes

## Testing Strategy

- Deno's built-in test runner
- Tests run with `--allow-none` (no permissions)
- Focus on unit testing pure functions
- Current coverage is minimal (opportunity for improvement)

## Development Guidelines

### When Adding Features
1. Start with types - model the domain first
2. Keep functions pure where possible
3. Use Result types for operations that can fail
4. Push effects (I/O, time, randomness) to the edges
5. Add inline TODO comments for future improvements

### Code Style
- Functional style: arrow functions, const declarations
- Explicit types for function parameters and returns
- Use discriminated unions for state modeling
- Prefer small, focused functions

### Security Considerations
- Security headers middleware already configured
- CORS setup in place
- Run with minimal Deno permissions
- Environment-based configuration

## Current TODO Items

The codebase contains numerous TODO comments indicating planned enhancements:
- Authentication/authorization middleware
- Request validation with Zod
- Rate limiting implementation
- OpenAPI documentation generation
- Database integration (Deno KV)
- Enhanced routing capabilities
- Monitoring and metrics

## Issue Tracking System

### How It Works
1. Scans code for markers: `TODO:`, `BUG:`, `FIXME:`, `XXX:`, `HACK:`
2. Generates timestamped snapshots in `.git-bin/`
3. Creates HTML dashboard with filtering/sorting
4. Can be integrated as git post-commit hook

### Generated Files
- `.git-bin/.issues`: Full repository scan
- `.git-bin/.bugs`: src/ directory TODO/BUG only
- `.git-bin/issues.html`: Interactive dashboard

## Common Development Tasks

### Adding a New Route
1. Add handler function in `src/http/handlers/`
2. Return `Result<Response, HandlerError>`
3. Register in router (`src/http/router.ts`)

### Adding Middleware
1. Create function matching `Middleware` type
2. Add to middleware pipeline in `src/main.ts`
3. Maintain composability - middleware should be independent

### Adding a Port/Adapter
1. Define interface in `src/ports/`
2. Implement in `src/adapters/`
3. Wire up in `src/main.ts` createApp function