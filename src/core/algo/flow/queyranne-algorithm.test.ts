/** Correctness, frame shape, and termination checks for Queyranne's algorithm. */
import { describe, expect, it } from "vitest";
import mod from "./queyranne-algorithm";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
    });
}

/** Exhaustive minimum directed cut over all proper vertex subsets. */
function brute(edges: Array<[string, string, number?]>): number {
    const vertices = [...new Set(edges.flatMap(([a, b]) => [a, b]))].sort();
    const n = vertices.length;
    let best = Infinity;
    for (let mask = 1; mask < (1 << n) - 1; mask += 1) {
        let value = 0;
        for (const [a, b, rawWeight] of edges) {
            const inA = Boolean(mask & (1 << vertices.indexOf(a)));
            const inB = Boolean(mask & (1 << vertices.indexOf(b)));
            if (inA !== inB) value += typeof rawWeight === "number" && rawWeight > 0 ? rawWeight : 1;
        }
        best = Math.min(best, value);
    }
    return best;
}

describe("Queyranne Minimum Directed Cut", () => {
    const cases: Array<{ edges: Array<[string, string, number?]>; root?: string }> = [
        { edges: [["A", "B", 1], ["B", "C", 1], ["C", "A", 1]], root: "C" },
        { edges: [["A", "B", 2], ["A", "C", 1], ["B", "C", 3], ["C", "D", 2], ["D", "E", 4], ["E", "F", 1], ["F", "D", 2]], root: "F" },
        { edges: [["A", "B", 5], ["B", "C", 1], ["C", "D", 5], ["D", "A", 1], ["B", "D", 2]], root: "A" },
        { edges: [["A", "B", 3], ["C", "D", 4], ["D", "E", 2]], root: "E" },
    ];

    for (const input of cases) {
        it(`matches the exhaustive minimum cut for ${JSON.stringify(input.edges.length)} edges`, () => {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["bestValue"]).toBe(brute(input.edges));
            const cutEdges = (final?.["bestCut"] as string).split(",").filter(Boolean);
            const optimum = brute(input.edges);
            if (optimum > 0) expect(cutEdges.length).toBeGreaterThan(0);
            const weight = new Map(input.edges.map(([a, b, w]) => [`${a}-${b}`, typeof w === "number" && w > 0 ? w : 1]));
            expect(cutEdges.reduce((s, e) => s + (weight.get(e) ?? 0), 0)).toBe(optimum);
        });
    }

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
