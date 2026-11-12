---
name: typescript-types
description: Type choices for the test framework — generated OpenAPI types, Zod-inferred types, narrowing without non-null assertions or casts. Use when typing a client method, payload, fixture, or response, or when tsc / eslint flags an unsafe type.
---

# typescript-types

Banned everywhere (ESLint): `any`, `!`, `as SomeType` on untrusted data, `import` without `import type` for types.

## Choosing the type

| Value | Type source |
|---|---|
| Request/response the API documents | `components['schemas'][…]` from `@generated/toolshop-api` (`npm run generate:types`) |
| Response you read in a test | Zod schema in `src/data/`, parsed with `readJson(response, schema)`; export `z.infer<typeof schema>` if needed |
| Variation of a known type | `Pick` / `Omit` / `Partial` of it, not a hand-copied interface |
| Closed set of values | `enum` (or `as const` record) — never a string union copied around |
| Function options | one typed options object, not boolean flags |
| Not known yet | `unknown`, then narrow |

`type` for unions and mapped types, `interface` only for object shapes meant to be extended. Prefer inferred return types on small private functions; annotate public ones (`Promise<APIResponse>`).

## Narrowing

```typescript
const parsed = schema.safeParse(JSON.parse(text))
if (!parsed.success) throw new Error(formatZod(parsed.error))
return parsed.data
```

- A nullable value is narrowed with a guard (`if (!value) throw new Error('…')`) or avoided by restructuring; never with `!`. In specs `expect(value, 'msg').not.toBeNull()` documents the expectation, the guard narrows the type.
- Index access (`array[0]`) is `T | undefined` under `noUncheckedIndexedAccess`; assert length or use `.at()` + guard.
- Reading JSON in helpers: `JSON.parse` returns `any` — pass it straight to a schema, never assign it to a typed variable.
