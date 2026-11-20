/**
 * beam-stack-search.test.ts - Correctness against an independent Dijkstra
 * reference, frame shape, and termination checks for beam stack search.
 */

import { describe, expect, it } from "vitest";
import mod from "./beam-stack-search";
import type { VisualFrame } from "@/types";

interface BssInput {
    graph: Record<string, Array<[string, number]>>;
    positions: Record<string, [number, number]>;
    start: string;
    target: string;
    beamWidth: number;
}

function edgeKey(u: string, v: string): string {
    return u < v ? `${u}-${v}` : `${v}-${u}`;
}

/** Independent Dijkstra on the full undirected graph. */
function reference(input: BssInput): number {
    const adjacency = new Map<string, Array<{ to: string; w: number }>>();
    const unique = new Map<string, { u: string; v: string; w: number }>();
    for (const [u, list] of Object.entries(input.graph)) {
        for (const [v, w] of list) {
            const key = edgeKey(u, v);
            if (!unique.has(key)) {
                unique.set(key, { u, v, w });
            }
        }
    }
    for (const key of [...Object.keys(input.graph), input.start, input.target]) {
        adjacency.set(key, []);
    }
    for (const edge of unique.values()) {
        adjacency.get(edge.u)?.push({ to: edge.v, w: edge.w });
        adjacency.get(edge.v)?.push({ to: edge.u, w: edge.w });
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
        expect(frame.layout).toBe("point");
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

describe("Beam Stack Search", () => {
    it("finds the optimal path on the default grid for several beam widths", () => {
        const base = mod.defaultInput as BssInput;
        const expected = reference(base);
        for (const beamWidth of [1, 2, 3, 5]) {
            const frames = [...mod.run({ ...base, beamWidth })];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            expect(final?.meta["found"]).toBe(true);
            expect(Number(final?.meta["pathCost"])).toBeCloseTo(expected, 6);

            const pathNodes = (final?.entities ?? []).filter((e) => e.state === "path");
            const pathEdges = (final?.edges ?? []).filter((e) => e.state === "path");
            expect(pathNodes.map((e) => e.id)).toContain(`node-${base.start}`);
            expect(pathNodes.map((e) => e.id)).toContain(`node-${base.target}`);
            expect(pathEdges.length).toBe(pathNodes.length - 1);
        }
    });

    it("matches Dijkstra on random weighted graphs regardless of beam width", () => {
        const labels = ["A", "B", "C", "D", "E", "F", "G", "H"];
        for (let t = 0; t < 20; t += 1) {
            const n = 4 + Math.floor(Math.random() * 5);
            const nodes = labels.slice(0, n);
            const graph: Record<string, Array<[string, number]>> = {};
            const positions: Record<string, [number, number]> = {};
            for (const node of nodes) {
                graph[node] = [];
                positions[node] = [Math.floor(Math.random() * 5), Math.floor(Math.random() * 5)];
            }
            for (let i = 0; i < n; i += 1) {
                for (let j = i + 1; j < n; j += 1) {
                    if (Math.random() < 0.55) {
                        const w = 1 + Math.floor(Math.random() * 9);
                        graph[nodes[i] as string]?.push([nodes[j] as string, w]);
                        graph[nodes[j] as string]?.push([nodes[i] as string, w]);
                    }
                }
            }
            const input: BssInput = {
                graph,
                positions,
                start: nodes[0] as string,
                target: nodes[n - 1] as string,
                beamWidth: 1 + Math.floor(Math.random() * 3),
            };
            const expected = reference(input);
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
