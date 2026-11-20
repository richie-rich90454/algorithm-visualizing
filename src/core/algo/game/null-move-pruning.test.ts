import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./null-move-pruning";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThanOrEqual(2);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.layout).toBe("tree");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
        f.edges.forEach((ed) => {
            expect(f.entities.some((e) => e.id === ed.sourceId)).toBe(true);
            expect(f.entities.some((e) => e.id === ed.targetId)).toBe(true);
        });
    });
}

function brute(leaves: number[], i: number, level: number, depth: number): number {
    if (i >= 2 ** depth) return leaves[i - 2 ** depth] ?? 0;
    const a = brute(leaves, i * 2, level + 1, depth);
    const b = brute(leaves, i * 2 + 1, level + 1, depth);
    return level % 2 === 0 ? Math.max(a, b) : Math.min(a, b);
}

describe("NullMovePruning", () => {
    const cases = [
        [3, 5, 2, 6, 1, 4, 7, 2, 9, 1],
        [8, 1, 7, 2, 6, 3, 5, 4, 10, 0],
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    ];
    it("keeps the exact minimax value despite null-move cutoffs", () => {
        for (const leaves of cases) {
            const fs = frames({ leaves, r: 1 });
            shapes(fs);
            const last = fs[fs.length - 1];
            expect(last?.meta.value).toBe(brute(leaves.slice(0, 8), 1, 0, 3));
        }
    });
    it("terminates and reports pruning statistics", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        expect(Number(last?.meta.nullSearches)).toBeGreaterThan(0);
        expect(Number(last?.meta.cutoffs)).toBeGreaterThanOrEqual(0);
        expect(last?.meta.optimal).toBe(last?.meta.value);
    });
});
