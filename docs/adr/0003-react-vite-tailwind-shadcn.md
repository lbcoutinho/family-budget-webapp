# ADR-0003 — React, Vite, Tailwind and shadcn/ui on the frontend

**Status:** Accepted
**Date:** 2026-07-22

## Context

An application dominated by forms, dense tables and charts. It needs accessible components and control over its visual identity, without spending time building primitives.

## Decision

React with Vite, Tailwind CSS for styling, and shadcn/ui as the component base.

## Alternatives considered

| Alternative | Why it was rejected |
|---|---|
| Create React App | Discontinued |
| Next.js | SSR and server routing bring no benefit to an authenticated personal app |
| Mantine | More components out of the box, but less aesthetic control and stiffer customization |
| Material UI | Strong visual identity that is hard to neutralize; larger bundle |
| CSS Modules or styled-components | More verbose; no design system out of the box |

## Consequences

### Positive
- shadcn components live in the repository and can be modified freely
- Accessibility inherited from Radix UI
- Vite provides fast HMR and a simple build

### Negative
- Copied components receive no automatic upstream updates
- Tailwind classes make JSX more verbose

### Risks and mitigations
- Style drift between screens → extract shared components early (M3-T06)
