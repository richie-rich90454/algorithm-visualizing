import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./k-d-heap";

type Point = [number, number];

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
        expect(Array.isArray(f.entities)).toBe(true);
        expect(f.edges).toEqual([]);
        expect(f.meta).toBeDefined();
        expect(typeof f.meta.heapValid).toBe("boolean");
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
    });
}

// Independently check the alternating parent-child heap property.
function checkOrder(heap: Point[]): boolean {
    for (let i = 1; i < heap.length; i += 1) {
        const p = (i - 1) >> 1;
        const d = Math.floor(Math.log2(p + 1)) % 2;
        if (heap[p]![d] > heap[i]![d]) return false;
    }
    return true;
}

describe("KDHeap", () => {
    const cases: Array<{ points: Point[]; extracts: number }> = [
        { points: [[4, 7], [1, 9], [6, 2], [3, 5], [8, 1], [2, 8], [7, 3], [5, 6]], extracts: 4 },
        { points: [[2, 2], [9, 1], [3, 8], [4, 4], [1, 5]], extracts: 5 },
        { points: [[5, 5], [5, 5], [0, 3], [7, 0]], extracts: 2 },
    ];

    it("extracts the same sorted x values as brute force and keeps a valid heap", () => {
        for (const input of cases) {
            const fs = frames(input);
            shapes(fs);
            const expected = input.points.map((p) => p[0]).sort((a, b) => a - b).slice(0, input.extracts);
            const last = fs[fs.length - 1];
            expect(last?.meta.extracted).toEqual(expected);
            expect(Number(last?.meta.remaining)).toBe(input.points.length - input.extracts);
            const heap = (last?.meta.heap as string[]).map((s) => s.split(",").map(Number) as Point);
            expect(checkOrder(heap)).toBe(true);
            expect(last?.meta.heapValid).toBe(true);
        }
    });

    it("maintains the alternating invariant on every frame and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        for (const f of fs) {
            const heap = (f.meta.heap as string[]).map((s) => s.split(",").map(Number) as Point);
            expect(checkOrder(heap)).toBe(true);
        }
        expect(fs[fs.length - 1]?.stepNumber).toBe(fs.length - 1);
    });
});
