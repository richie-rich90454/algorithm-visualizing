/**
 * geo-util.ts – Shared helpers for computational geometry visualizations.
 *
 * Geometry algorithms work with points and segments. Points are drawn as
 * nodes; segments as edges. This module centralizes that construction so
 * every geometry module produces consistent visuals.
 */

import type { VisualEdge, VisualEntity } from "@/types";

/**
 * Build node entities for a list of points.
 *
 * @param points The points as [x, y] pairs.
 * @returns Node entities with ids `point-<index>`.
 */
export function makePointNodes(points: Array<[number, number]>): VisualEntity[] {
    return points.map(([x, y], index) => ({
        id: `point-${index}`,
        type: "node" as const,
        label: String(index),
        value: [x, y],
        state: "unvisited" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { x, y, index },
    }));
}

/**
 * Build edge entities connecting consecutive points (a polyline/polygon).
 *
 * @param indices The ordered point indices to connect.
 * @param closed Whether to close the loop back to the first point.
 * @returns Edge entities in `idle` state.
 */
export function makeSegmentEdges(indices: number[], closed = false): VisualEdge[] {
    const edges: VisualEdge[] = [];
    const count = indices.length;
    for (let i = 0; i < count; i += 1) {
        const from = indices[i];
        const to = indices[(i + 1) % count];
        if (closed || i < count - 1) {
            edges.push({
                id: `edge-${from}-${to}`,
                sourceId: `point-${from}`,
                targetId: `point-${to}`,
                label: "",
                state: "idle",
                directed: false,
            });
        }
    }
    return edges;
}
