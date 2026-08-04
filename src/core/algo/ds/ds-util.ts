/**
 * ds-util.ts – Shared helpers for data-structure visualizations.
 *
 * Data structures (arrays, lists, queues, heaps, trees, hash maps, …) are
 * visualised by showing the underlying storage as bars or cells and narrating
 * insert / delete / search operations step by step. This module centralises
 * the common entity builders.
 */

import type { EntityState, VisualEntity } from "@/types";

/**
 * Build bar entities for an array of values.
 *
 * @param values The values to display.
 * @param states Optional index → state overrides.
 * @param prefix Id prefix so several arrays can coexist in one frame.
 * @returns Bar entities.
 */
export function makeArrayBars(
    values: number[],
    states: Map<number, EntityState> = new Map(),
    prefix = "bar",
): VisualEntity[] {
    return values.map((value, index) => ({
        id: `${prefix}-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/**
 * Build cell entities for a row of values.
 *
 * @param values The values to display.
 * @param states Optional index → state overrides.
 * @param prefix Id prefix.
 * @returns Cell entities in a single-row grid.
 */
export function makeArrayCells(
    values: Array<number | string>,
    states: Map<number, EntityState> = new Map(),
    prefix = "cell",
): VisualEntity[] {
    return values.map((value, index) => ({
        id: `${prefix}-${index}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}
