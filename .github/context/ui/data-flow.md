# UI Data Flow

- Axios client at apps/web/lib/api/axios.ts
- Typed API clients in apps/web/lib/api/*.ts (never call fetch)
- TanStack Query hooks in apps/web/lib/api/hooks.ts
- Selected project code stored in Zustand (apps/web/lib/state/project.store.ts)
- Projects page renders @repo/types.Project fields

