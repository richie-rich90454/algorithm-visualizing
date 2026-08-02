/**
 * index.ts – Re-export hub for every type in the engine.
 *
 * Consumers can import anything they need from `@/types` without reaching
 * into the individual modules. Keeping a single barrel file means the import
 * paths in the visualiser, renderers, and layouts stay short and consistent.
 */

export * from "./visual";
export * from "./algo";
