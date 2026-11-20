/**
 * customizable-route-planning.test.ts - Verifies that the CRP overlay query
 * equals Dijkstra on the full customized graph, plus frame shape and
 * termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./customizable-route-planning";
import type { VisualFrame } from "@/types";

interface CrpInput {
    graph: Record<string, Array<[string, number]>>;
    cells: Record<string, number>;
    start: string;
    target: string;
    customization: Record<string, number>;
}

function edgeKey(u: string, v: string): string {
    return u < v ? `${u}-${v}` : `${v}-${u}`;
}

/** Independent Dijkstra on the full graph with customized edge weights. */
function fullGraphDistance(input: CrpInput): number {
    const edges = new Map<string, { u: string; v: string; w: number }>();
    for (const [u, neighbors] of Object.entries(input.graph)) {
        for (const [v, w] of neighbors) {
            const key = edgeKey(u, v);
            if (!edges.has(key)) {
                edges.set(key, { u, v, w });
            }
        }
    }
    const adjacency = new Map<string, Array<{ to: string; w: number }>>();
    for (const node of [...Object.keys(input.graph), input.start, input.target]) {
        adjacency.set(node, []);
    }
    for (const [key, edge] of edges) {
        const w = input.customization[key] ?? edge.w;
        adjacency.get(edge.u)?.push({ to: edge.v, w });
        adjacency.get(edge.v)?.push({ to: edge.u, w });
    }
    const dist = new Map<string, number>();
    const used = new Set<string>();
    for (const key of adjacency.keys()) {
        dist.set(key, Infinity);
    }
    dist.set(input.start, 0);
    while (true) {
        let pick: string | undefined;
        let best = Infinity;
        for (const [key, value] of dist) {
            if (!used.has(key) && value < best) {
                pick = key;
                best = value;
            }
        }
        if (pick === undefined || best === Infinity) {
            break;
        }
        used.add(pick);
        for (const entry of adjacency.get(pick) ?? []) {
            if (!used.has(entry.to) && best + entry.w < (dist.get(entry.to) as number)) {
                dist.set(entry.to, best + entry.w);
            }
        }
    }
    return dist.get(input.target) as number;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Customizable Route Planning", () => {
    it("matches full-graph Dijkstra on the default input", () => {
        const input = mod.defaultInput as CrpInput;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["found"]).toBe(true);
        expect(Number(final?.meta["pathCost"])).toBeCloseTo(fullGraphDistance(input), 6);
    });

    it("matches full-graph Dijkstra across random partitions and traffic changes", () => {
        const labels = ["A", "B", "C", "D", "E", "F", "G", "H"];
        for (let t = 0; t < 20; t += 1) {
            const n = 5 + Math.floor(Math.random() * 4);
            const nodes = labels.slice(0, n);
            const graph: Record<string, Array<[string, number]>> = {};
            const cells: Record<string, number> = {};
            for (const node of nodes) {
                graph[node] = [];
                cells[node] = Math.floor(Math.random() * 3);
            }
            for (let i = 0; i < n; i += 1) {
                for (let j = i + 1; j < n; j += 1) {
                    if (Math.random() < 0.5) {
                        const w = 1 + Math.floor(Math.random() * 9);
                        graph[nodes[i] as string]?.push([nodes[j] as string, w]);
                        graph[nodes[j] as string]?.push([nodes[i] as string, w]);
                    }
                }
            }
            const customization: Record<string, number> = {};
            for (const [u, neighbors] of Object.entries(graph)) {
                for (const [v] of neighbors) {
                    if (Math.random() < 0.2) {
                        customization[edgeKey(u, v)] = 1 + Math.floor(Math.random() * 9);
                    }
                }
            }
            const input: CrpInput = {
                graph,
                cells,
                start: nodes[0] as string,
                target: nodes[n - 1] as string,
                customization,
            };
            const expected = fullGraphDistance(input);
            if (!Number.isFinite(expected)) {
                continue;
            }
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            expect(Number(final?.meta["pathCost"])).toBeCloseTo(expected, 6);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
