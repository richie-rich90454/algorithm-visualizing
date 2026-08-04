/**
 * flow-util.ts â€?Shared helpers for network flow visualizations.
 *
 * Max-flow algorithms (Ford-Fulkerson, Edmonds-Karp, Dinic, â€? all share the
 * same scaffold: a directed capacity graph, a source, a sink, and the notion
 * of pushing flow along residual edges. This module centralises the entity
 * construction and the residual-capacity bookkeeping so each flow algorithm
 * only implements its own search strategy.
 */

import type { VisualEdge, VisualEntity } from "@/types";

/**
 * Build one `VisualEntity` per vertex in the flow network.
 *
 * @param vertices The vertex labels, in order.
 * @returns Node entities with placeholder positions (graph layout fills them).
 */
export function makeFlowNodes(vertices: string[]): VisualEntity[] {
    return vertices.map((label) => ({
        id: `node-${label}`,
        type: "node" as const,
        label,
        value: label,
        state: "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label },
    }));
}

/**
 * Build a visual edge per directed capacity edge, labeled with its capacity.
 *
 * @param edges The directed edges: `[from, to, capacity]`.
 * @returns Edge entities in `idle` state.
 */
export function makeFlowEdges(edges: Array<[string, string, number]>): VisualEdge[] {
    return edges.map(([from, to, capacity], index) => ({
        id: `edge-${index}`,
        sourceId: `node-${from}`,
        targetId: `node-${to}`,
        label: String(capacity),
        state: "idle",
        directed: true,
    }));
}

/**
 * A residual-capacity table for the flow network.
 *
 * `get(u, v)` returns the residual capacity of the uâ†’v edge (which starts at
 * the original capacity and changes as flow is pushed), while `push` routes
 * `amount` of flow from u to v by reducing the forward residual and raising
 * the backward one. The backward entries (the "reverse edges") are what make
 * flow cancellation possible.
 */
export class ResidualGraph {
    private caps = new Map<string, number>();

    set(u: string, v: string, capacity: number): void {
        this.caps.set(`${u}â†?{v}`, capacity);
    }

    get(u: string, v: string): number {
        return this.caps.get(`${u}â†?{v}`) ?? 0;
    }

    add(u: string, v: string, amount: number): void {
        this.caps.set(`${u}â†?{v}`, this.get(u, v) + amount);
    }

    push(u: string, v: string, amount: number): void {
        this.add(u, v, -amount);
        this.add(v, u, amount);
    }
}
