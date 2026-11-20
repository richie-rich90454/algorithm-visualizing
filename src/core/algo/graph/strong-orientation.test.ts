/** strong-orientation.test.ts - Independent bridge detection, reachability, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./strong-orientation";
import type { VisualFrame } from "@/types";

type Graph = Record<string, string[]>;

function uniqueEdges(graph: Graph): Array<[string, string]> {
    const seen = new Set<string>();
    const edges: Array<[string, string]> = [];
    for (const [a, nbs] of Object.entries(graph)) {
        for (const b of nbs) {
            const key = a < b ? `${a}-${b}` : `${b}-${a}`;
            if (!seen.has(key)) {
                seen.add(key);
                edges.push([a, b]);
            }
        }
    }
    return edges;
}

function verticesOf(graph: Graph): string[] {
    const set = new Set<string>();
    for (const [a, nbs] of Object.entries(graph)) {
        set.add(a);
        for (const b of nbs) set.add(b);
    }
    return [...set];
}

/** Independent bridge check: an edge is a bridge if removing it disconnects its endpoints. */
function bridgeCount(graph: Graph): number {
    const edges = uniqueEdges(graph);
    const verts = verticesOf(graph);
    let bridges = 0;
    for (const [ra, rb] of edges) {
        const seen = new Set<string>([ra]);
        const queue = [ra];
        while (queue.length > 0) {
            const u = queue.shift() as string;
            for (const [a, b] of edges) {
                if (a === ra && b === rb) continue;
                const other = a === u ? b : b === u ? a : null;
                if (other !== null && !seen.has(other)) {
                    seen.add(other);
                    queue.push(other);
                }
            }
        }
        if (!seen.has(rb)) bridges += 1;
    }
    expect(verts.length).toBeGreaterThan(0);
    return bridges;
}

function connectedComponents(graph: Graph): number {
    const verts = verticesOf(graph);
    const edges = uniqueEdges(graph);
    const seen = new Set<string>();
    let components = 0;
    for (const v of verts) {
        if (seen.has(v)) continue;
        components += 1;
        seen.add(v);
        const queue = [v];
        while (queue.length > 0) {
            const u = queue.shift() as string;
            for (const [a, b] of edges) {
                const other = a === u ? b : b === u ? a : null;
                if (other !== null && !seen.has(other)) {
                    seen.add(other);
                    queue.push(other);
                }
            }
        }
    }
    return components;
}

function finalMeta(input: unknown): Record<string, unknown> {
    const frames = [...mod.run(input)];
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        for (const e of frame.edges) {
            expect(frame.entities.some((n) => n.id === e.sourceId)).toBe(true);
            expect(frame.entities.some((n) => n.id === e.targetId)).toBe(true);
            expect(e.directed).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Strong orientation", () => {
    it("matches independent bridge and component detection", () => {
        const cases: Graph[] = [
            { A: ["B", "D"], B: ["A", "C", "D"], C: ["B", "D"], D: ["A", "B", "C"] },
            { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] },
            { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] },
            { A: ["B", "C", "D"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["A", "B", "C"] },
            { A: ["B"], B: ["A"], C: ["D"], D: ["C"] },
        ];
        for (const graph of cases) {
            const meta = finalMeta({ graph });
            expect(meta["bridges"]).toBe(bridgeCount(graph));
            expect(meta["components"]).toBe(connectedComponents(graph));
            expect(meta["stronglyConnected"]).toBe(
                bridgeCount(graph) === 0 && connectedComponents(graph) === 1,
            );
        }
    });

    it("orients every undirected edge exactly once and verifies reachability", () => {
        const graph: Graph = { A: ["B", "D"], B: ["A", "C", "D"], C: ["B", "D"], D: ["A", "B", "C"] };
        const meta = finalMeta({ graph });
        const directed = String(meta["directed"] ?? "")
            .split("|")
            .filter((s) => s.length > 0)
            .map((s) => s.split(">"));
        const undirected = uniqueEdges(graph);
        expect(directed.length).toBe(undirected.length);
        for (const [from, to] of directed) {
            const keys = undirected.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`));
            const key = (from as string) < (to as string)
                ? `${from}-${to}`
                : `${to}-${from}`;
            expect(keys).toContain(key);
        }
        if (meta["stronglyConnected"] === true) {
            const verts = verticesOf(graph);
            for (const src of verts) {
                const seen = new Set<string>([src]);
                const queue = [src];
                while (queue.length > 0) {
                    const u = queue.shift() as string;
                    for (const [a, b] of directed) {
                        if (a === u && !seen.has(b as string)) {
                            seen.add(b as string);
                            queue.push(b as string);
                        }
                    }
                }
                expect(seen.size).toBe(verts.length);
            }
        }
    });

    it("has well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
