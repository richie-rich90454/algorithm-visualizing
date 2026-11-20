/** gallai-edmonds-decomposition.test.ts - Brute-force partition check, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import gallaiEdmondsDecomposition from "./gallai-edmonds-decomposition";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? -1).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 999).toBeLessThan(gallaiEdmondsDecomposition.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("graph");
        expect(frame.meta).toBeTypeOf("object");
        frame.edges.forEach((edge) => {
            const ids = new Set(frame.entities.map((entity) => entity.id));
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        });
    });
}

function sumAll(generator: Generator<VisualFrame, void, unknown>): VisualFrame[] {
    const frames: VisualFrame[] = [];
    for (const frame of generator) {
        frames.push(frame);
        expect(frames.length).toBeLessThan(100000);
    }
    return frames;
}

function brutePartition(nodes: string[], edges: Array<[string, string]>): { D: string[]; A: string[]; C: string[] } {
    let best = -1;
    const freeSets: Array<Set<string>> = [];
    for (let mask = 0; mask < 2 ** edges.length; mask += 1) {
        const used = new Set<string>();
        let valid = true;
        for (let e = 0; e < edges.length; e += 1) {
            if ((mask >> e) & 1) {
                const [u, v] = edges[e] as [string, string];
                if (used.has(u) || used.has(v)) {
                    valid = false;
                    break;
                }
                used.add(u);
                used.add(v);
            }
        }
        if (!valid) {
            continue;
        }
        if (used.size > best) {
            best = used.size;
            freeSets.length = 0;
        }
        if (used.size === best) {
            freeSets.push(new Set(nodes.filter((node) => !used.has(node))));
        }
    }
    const D = new Set<string>();
    for (const free of freeSets) {
        for (const node of free) {
            D.add(node);
        }
    }
    const A = new Set<string>();
    for (const [u, v] of edges) {
        if (D.has(u) && !D.has(v)) {
            A.add(v);
        }
        if (D.has(v) && !D.has(u)) {
            A.add(u);
        }
    }
    const C = nodes.filter((node) => !D.has(node) && !A.has(node));
    return { D: [...D].sort(), A: [...A].sort(), C: C.sort() };
}

describe("Gallai-Edmonds Decomposition", () => {
    it("matches an independent partition computation", () => {
        const cases = [
            { nodes: ["A", "B", "C", "D", "E"], edges: [["A", "B"], ["B", "C"], ["C", "D"], ["D", "E"]] },
            { nodes: ["A", "B", "C", "D"], edges: [["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"]] },
            { nodes: ["A", "B", "C"], edges: [["A", "B"], ["B", "C"]] },
            { nodes: ["A", "B", "C"], edges: [["A", "B"], ["B", "C"], ["A", "C"]] },
        ] as Array<{ nodes: string[]; edges: Array<[string, string]> }>;
        for (const graph of cases) {
            const frames = sumAll(gallaiEdmondsDecomposition.run({ graph }));
            const final = frames[frames.length - 1];
            const expected = brutePartition(graph.nodes, graph.edges);
            expect(final?.meta["D"]).toEqual(expected.D);
            expect(final?.meta["A"]).toEqual(expected.A);
            expect(final?.meta["C"]).toEqual(expected.C);
        }
    });

    it("emits well-formed frames and terminates on the default input", () => {
        checkFrames(sumAll(gallaiEdmondsDecomposition.run(gallaiEdmondsDecomposition.defaultInput)));
        const generator = gallaiEdmondsDecomposition.run(gallaiEdmondsDecomposition.defaultInput);
        let count = 0;
        while (generator.next().done !== true) {
            count += 1;
            expect(count).toBeLessThan(100000);
        }
    });
});
