/**
 * graph-util.ts – Shared helpers for graph algorithm visualisations.
 *
 * Every graph algorithm needs to turn an adjacency list into node and edge
 * entities, then update node/edge states frame by frame. Instead of
 * duplicating that construction in a dozen files, this module centralises it.
 *
 * The adjacency-list format used across the graph algorithms is:
 *   { "A": ["B", "C"], "B": ["C"], ... }
 * with optional weights:
 *   { "A": [["B", 4], ["C", 2]], ... }
 * A weight helper is provided so each algorithm can decide which format it
 * feeds in.
 */

import type { VisualEdge, VisualEntity } from "@/types";

/**
 * Build one `VisualEntity` per vertex in the graph.
 *
 * @param vertices The vertex labels, in order.
 * @returns Node entities with unique ids (`node-<label>`) and placeholder
 *          positions (the graph layout engine fills them in later).
 */
export function makeGraphNodes(vertices: string[]): VisualEntity[] {
    // Each vertex starts life as a shy little circle, waiting to be explored.
    return vertices.map((label) => ({
        id: `node-${label}`,
        type: "node" as const,
        label,
        value: label,
        state: "unvisited" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label },
    }));
}

/**
 * Build one `VisualEdge` per directed connection in the graph.
 *
 * @param adjacency Adjacency list: vertex → list of neighbours.
 * @returns Edge entities (`edge-<from>-<to>`) in `idle` state.
 */
export function makeGraphEdges(adjacency: Record<string, string[]>): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (const [source, neighbours] of Object.entries(adjacency)) {
        for (const target of neighbours) {
            edges.push({
                id: `edge-${source}-${target}`,
                sourceId: `node-${source}`,
                targetId: `node-${target}`,
                label: "",
                state: "idle",
                directed: true,
            });
        }
    }
    return edges;
}

/**
 * Build a *weighted* edge list from an adjacency list of `[neighbour, weight]`
 * pairs.
 *
 * @param adjacency Adjacency list: vertex → array of [neighbour, weight].
 * @returns Edge entities whose labels carry the edge weight.
 */
export function makeWeightedEdges(
    adjacency: Record<string, Array<[string, number]>>,
): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (const [source, neighbours] of Object.entries(adjacency)) {
        for (const [target, weight] of neighbours) {
            edges.push({
                id: `edge-${source}-${target}`,
                sourceId: `node-${source}`,
                targetId: `node-${target}`,
                label: String(weight),
                state: "idle",
                directed: true,
            });
        }
    }
    return edges;
}
