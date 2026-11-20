import { describe, expect, it } from "vitest";
import dualPivotQuickSort from "./dual-pivot-quicksort";

const VALID = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

describe("DualPivotQuickSort", () => {
    it("yields well-formed array frames and terminates", () => {
        let index = 0;
        let frames = 0;
        for (const frame of dualPivotQuickSort.run(dualPivotQuickSort.defaultInput)) {
            expect(frame.stepNumber).toBe(index);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(Array.isArray(frame.edges)).toBe(true);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(dualPivotQuickSort.pseudocode!.length);
            expect(frame.layout).toBe("array");
            expect(frame.meta).toBeDefined();
            for (const entity of frame.entities) {
                expect(entity.type).toBe("bar");
                expect(VALID.has(entity.state)).toBe(true);
                expect(entity.metadata).toBeDefined();
            }
            index += 1;
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });

    it("sorts many random arrays exactly like the reference sort", () => {
        let seed = 7;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const len = rand() % 12;
            const arr = Array.from({ length: len }, () => (rand() % 21) - 10);
            const generator = dualPivotQuickSort.run([...arr]);
            let last = null;
            for (const frame of generator) last = frame;
            expect(last).not.toBeNull();
            const out = (last!.entities.map((e) => e.value) as number[]);
            expect(out).toEqual([...arr].sort((a, b) => a - b));
        }
    });
});
