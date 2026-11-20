/**
 * graphlet-degree-vector.test.ts - Brute-force orbit counts, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./graphlet-degree-vector";
import type { VisualFrame } from "@/types";

type Edge = [string, string];

/** Independent reference: classify each triple using an edge-key set. */
function reference(nodes: string[], edges: Edge[]): Record<string, [number, number, number]> {
    const keys = new Set(edges.map(([a, b]) => [a, b].sort().join("|")));
    const out: Record<string, [number, number, number]> = {};
    for (const v of nodes) out[v] = [0, 0, 0];
    for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        if (!a) continue;
        for (let j = i + 1; j < nodes.length; j += 1) {
            const b = nodes[j];
            if (!b) continue;
            for (let k = j + 1; k < nodes.length; k += 1) {
                const c = nodes[k];
                if (!c) continue;
                const has = (x: string, y: string): boolean => keys.has([x, y].sort().join("|"));
                const present = [has(a, b), has(a, c), has(b, c)];
                const count = present.filter(Boolean).length;
                if (count === 3) {
                    const t = out[a] as [number, number, number];
                    const u = out[b] as [number, number, number];
                    const w = out[c] as [number, number, number];
                    t[0] += 1;
                    u[0] += 1;
                    w[0] += 1;
                } else if (count === 2) {
                    const deg = new Map([[a, 0], [b, 0], [c, 0]]);
                    if (present[0]) {
                        deg.set(a, (deg.get(a) ?? 0) + 1);
                        deg.set(b, (deg.get(b) ?? 0) + 1);
                    }
                    if (present[1]) {
                        deg.set(a, (deg.get(a) ?? 0) + 1);
                        deg.set(c, (deg.get(c) ?? 0) + 1);
                    }
                    if (present[2]) {
                        deg.set(b, (deg.get(b) ?? 0) + 1);
                        deg.set(c, (deg.get(c) ?? 0) + 1);
                    }
                    for (const [v, d] of deg) {
                        const vec = out[v] as [number, number, number];
                        if (d === 2) vec[1] += 1;
                        else vec[2] += 1;
                    }
                }
            }
        }
    }
    return out;
}

function checkFrames(frames: VisualFrame[], expectedNodes: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(expectedNodes);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
    for (const edge of frames[frames.length - 1]?.edges ?? []) {
        expect(frames[frames.length - 1]?.entities.some((e) => e.id === edge.sourceId)).toBe(true);
        expect(frames[frames.length - 1]?.entities.some((e) => e.id === edge.targetId)).toBe(true);
    }
}

function seedFrom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("Graphlet Degree Vector", () => {
    it("matches a brute-force orbit classifier on the default graph", () => {
        const input = mod.defaultInput as { nodes: string[]; edges: Edge[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.nodes.length);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["gdv"]).toEqual(reference(input.nodes, input.edges));
    });

    it("matches the brute-force reference on random small graphs", () => {
        const rand = seedFrom(42);
        for (let trial = 0; trial < 20; trial += 1) {
            const n = 4 + Math.floor(rand() * 3);
            const nodes = Array.from({ length: n }, (_, i) => `V${i}`);
            const edges: Edge[] = [];
            for (let i = 0; i < n; i += 1) {
                for (let j = i + 1; j < n; j += 1) {
                    if (rand() < 0.55) edges.push([nodes[i] as string, nodes[j] as string]);
                }
            }
            const frames = [...mod.run({ nodes, edges })];
            checkFrames(frames, n);
            expect(frames[frames.length - 1]?.meta["gdv"]).toEqual(reference(nodes, edges));
        }
    });

    it("terminates cleanly and handles an empty graph", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);

        const empty = [...mod.run({ nodes: [], edges: [] })];
        expect(empty.length).toBe(1);
        expect(empty[0]?.entities.length).toBe(1);
    });
});
