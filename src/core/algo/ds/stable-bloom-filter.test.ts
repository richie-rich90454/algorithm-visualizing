import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./stable-bloom-filter";

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
        expect(f.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
    });
}

describe("StableBloomFilter", () => {
    const cases = [
        { inserts: [3, 7, 11, 3, 15, 21, 7, 30], queries: [3, 7, 99, 21, 30, 50], m: 24, window: 5 },
        { inserts: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], queries: [10, 9, 8, 7, 6, 5, 1], m: 32, window: 4 },
        { inserts: [2, 4, 6, 8], queries: [8, 6, 2, 100], m: 16, window: 3 },
    ];

    it("has no false negatives for values inside the sliding window", () => {
        for (const input of cases) {
            const fs = frames(input);
            shapes(fs);
            const last = fs[fs.length - 1];
            const results = last?.meta.queryResults as number[];
            const cells = last?.meta.cells as number[];
            expect(cells.length).toBe(input.m);
            expect(Number(last?.meta.generation)).toBe(input.inserts.length);
            expect(Number(last?.meta.pointer)).toBe(input.inserts.length % input.m);

            const recent = new Set(input.inserts.slice(-input.window));
            for (let i = 0; i < input.queries.length; i += 1) {
                if (recent.has(input.queries[i]!)) {
                    expect(results[i]).toBe(1);
                }
            }
            expect(results.length).toBe(input.queries.length);
        }
    });

    it("keeps stamps consistent with the generation and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        const cells = last?.meta.cells as number[];
        const generation = Number(last?.meta.generation);
        expect(cells.every((stamp) => stamp >= 0 && stamp <= generation)).toBe(true);
        expect(fs[fs.length - 1]?.stepNumber).toBe(fs.length - 1);
    });
});
