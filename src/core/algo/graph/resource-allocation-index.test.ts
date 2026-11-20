import { describe, expect, it } from "vitest";
import mod from "./resource-allocation-index";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function neighborSets(edges: Array<[string, string]>): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    for (const [a, b] of edges) {
        if (!map.has(a)) map.set(a, new Set());
        if (!map.has(b)) map.set(b, new Set());
        map.get(a)!.add(b);
        map.get(b)!.add(a);
    }
    return map;
}

describe("Resource Allocation Index", () => {
    it("matches a brute-force one-over-degree sum over shared neighbors", () => {
        const input = mod.defaultInput as { edges: Array<[string, string]> };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        const pairs = meta["pairs"] as string[];
        const scores = meta["scores"] as number[];
        const neighbors = neighborSets(input.edges);
        expect(pairs.length).toBe(scores.length);
        pairs.forEach((pair, index) => {
            const [a, b] = pair.split("-");
            const setA = neighbors.get(a!) ?? new Set<string>();
            const setB = neighbors.get(b!) ?? new Set<string>();
            let expected = 0;
            for (const vertex of setA) {
                if (setB.has(vertex)) {
                    expected += 1 / neighbors.get(vertex)!.size;
                }
            }
            expect(scores[index]).toBeCloseTo(expected, 9);
        });
        expect(meta["topScore"]).toBeCloseTo(Math.max(...scores), 9);
    });

    it("gives a low-degree shared neighbor more weight than a hub", () => {
        const edges: Array<[string, string]> = [
            ["A", "X"], ["A", "Y"], ["B", "X"], ["B", "Y"],
            ["Y", "P"], ["Y", "Q"], ["Y", "R"], ["Y", "S"],
        ];
        const frames = [...mod.run({ edges, pairs: [["A", "B"]] })];
        const meta = frames[frames.length - 1]!.meta;
        const neighbors = neighborSets(edges);
        let expected = 0;
        for (const vertex of neighbors.get("A")!) {
            if (neighbors.get("B")!.has(vertex)) {
                expected += 1 / neighbors.get(vertex)!.size;
            }
        }
        expect((meta["scores"] as number[])[0]).toBeCloseTo(expected, 9);
        expect(expected).toBeCloseTo(1 / 2 + 1 / 6, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
