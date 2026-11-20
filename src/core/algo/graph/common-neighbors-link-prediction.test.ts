import { describe, expect, it } from "vitest";
import mod from "./common-neighbors-link-prediction";
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

describe("Common Neighbors Link Prediction", () => {
    it("matches brute-force intersection counts for every candidate pair", () => {
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
            const expected = [...setA].filter((vertex) => setB.has(vertex)).length;
            expect(scores[index]).toBe(expected);
        });
        const maxScore = Math.max(...scores);
        expect(meta["topScore"]).toBe(maxScore);
        expect(pairs.some((pair) => pair === meta["topPair"] && scores[pairs.indexOf(pair)] === maxScore)).toBe(true);
    });

    it("honors an explicit candidate pair list", () => {
        const edges: Array<[string, string]> = [["A", "B"], ["A", "C"], ["B", "C"], ["B", "D"], ["C", "D"], ["D", "E"]];
        const frames = [...mod.run({ edges, pairs: [["A", "D"], ["A", "E"]] })];
        const meta = frames[frames.length - 1]!.meta;
        expect(meta["pairs"]).toEqual(["A-D", "A-E"]);
        expect(meta["scores"]).toEqual([2, 0]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
