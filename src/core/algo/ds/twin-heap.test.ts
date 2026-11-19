import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./twin-heap";

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

function pairOrder(node: [number, number | null]): boolean {
    return node[1] === null || node[0] <= node[1];
}

describe("TwinHeap", () => {
    const cases = [
        { values: [6, 2, 9, 1, 7, 4, 8, 3, 5], extracts: 9 },
        { values: [5, 5, 1, 1, 3, 3, 2, 2], extracts: 8 },
        { values: [10, -3, 4, 0, 7], extracts: 5 },
        { values: [8, 6, 4, 2], extracts: 2 },
    ];

    it("extracts exactly the sorted values released from the twin nodes", () => {
        for (const input of cases) {
            const fs = frames(input);
            shapes(fs);
            const last = fs[fs.length - 1];
            expect(last?.meta.extracted).toEqual(input.values.slice().sort((a, b) => a - b).slice(0, input.extracts));
            expect(Number(last?.meta.remaining)).toBe(input.values.length - input.extracts);
            expect(last?.meta.heapValid).toBe(true);
        }
    });

    it("keeps every node internally sorted and the heap ordered on all frames", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        for (const f of fs) {
            const heap = (f.meta.heap as string[]).map((s) => {
                const [a, b] = s.split(",");
                return [Number(a), b === "-" ? null : Number(b)] as [number, number | null];
            });
            expect(heap.every(pairOrder)).toBe(true);
            expect(f.meta.heapValid).toBe(true);
        }
        expect(fs[fs.length - 1]?.stepNumber).toBe(fs.length - 1);
    });
});
