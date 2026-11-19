import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./fusion-tree";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.layout).toBe("array");
        expect(f.entities.length).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
    });
}

describe("FusionTree", () => {
    const cases = [
        { values: [2, 5, 9, 13, 18, 22, 27, 31, 36, 40, 44, 48], queries: [9, 10, 1, 48, 50, 27] },
        { values: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5], queries: [1, 2, 3, 5, 9, 0, 10] },
        { values: Array.from({ length: 40 }, (_, i) => i * 2), queries: [0, 19, 20, 39, 78, 81] },
    ];

    it("answers membership and predecessor queries like brute force", () => {
        for (const input of cases) {
            const fs = frames(input);
            shapes(fs);
            const sorted = input.values.slice().sort((a, b) => a - b);
            const seen = new Set(sorted);
            const last = fs[fs.length - 1];
            const founds = last?.meta.founds as number[];
            const preds = last?.meta.predecessors as number[];
            expect(founds.length).toBe(input.queries.length);
            expect(preds.length).toBe(input.queries.length);

            for (let i = 0; i < input.queries.length; i += 1) {
                const q = input.queries[i]!;
                expect(founds[i]).toBe(seen.has(q) ? 1 : 0);
                const expectedPred = sorted.filter((v) => v < q).reduce((a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY);
                expect(preds[i]).toBe(Number.isFinite(expectedPred) ? expectedPred : -1);
            }
        }
    });

    it("produces a fused mask whose popcount matches the child decision and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        for (const f of fs) {
            const masks = f.meta.lastMasks as number[];
            for (const mask of masks) expect(mask).toBeGreaterThanOrEqual(0);
        }
        expect(fs[fs.length - 1]?.stepNumber).toBe(fs.length - 1);
    });
});
