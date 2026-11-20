/** Approximation bound, frame shape, and termination checks for Leighton-Rao. */
import { describe, expect, it } from "vitest";
import mod from "./leighton-rao-sparsest-cut";
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

function exact(edges: Array<[string, string, number?]>): number {
    const vertices = [...new Set(edges.flatMap(([a, b]) => [a, b]))].sort();
    const n = vertices.length;
    let best = Infinity;
    for (let mask = 1; mask < (1 << n) - 1; mask += 1) {
        let cut = 0;
        for (const [a, b, w] of edges) {
            const inA = Boolean(mask & (1 << vertices.indexOf(a)));
            const inB = Boolean(mask & (1 << vertices.indexOf(b)));
            if (inA !== inB) cut += typeof w === "number" && w > 0 ? w : 1;
        }
        const size = vertices.filter((_, i) => Boolean(mask & (1 << i))).length;
        best = Math.min(best, cut / (size * (n - size)));
    }
    return best;
}

describe("Leighton-Rao Sparsest Cut", () => {
    const cases: Array<Array<[string, string, number?]>> = [
        [["A", "B", 1], ["B", "C", 1], ["C", "A", 1], ["C", "D", 4], ["D", "E", 1], ["E", "F", 1], ["F", "D", 1]],
        [["A", "B", 2], ["A", "C", 1], ["B", "C", 2], ["C", "D", 5], ["D", "E", 1], ["E", "F", 1]],
        [["A", "B", 1], ["B", "C", 1], ["C", "D", 1], ["D", "E", 1]],
    ];

    for (const edges of cases) {
        it(`returns a cut within O(log n) of the optimum for ${edges.length} edges`, () => {
            const frames = [...mod.run({ edges })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const n = new Set(edges.flatMap(([a, b]) => [a, b])).size;
            const found = final?.["bestRatio"] as number;
            const optimum = exact(edges);
            expect(found).toBeGreaterThanOrEqual(optimum - 1e-6);
            expect(found).toBeLessThanOrEqual(optimum * (1 + Math.log(n)) + 1e-6);
            const side = final?.["bestSide"] as string;
            expect(side.length).toBe(n);
            expect(side).toContain("0");
            expect(side).toContain("1");
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
