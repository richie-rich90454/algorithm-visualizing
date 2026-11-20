import { describe, expect, it } from "vitest";
import oscillatingMergeSort from "./oscillating-merge-sort";

const VALID = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

describe("OscillatingMergeSort", () => {
    it("yields well-formed array frames and terminates", () => {
        let index = 0;
        let frames = 0;
        for (const frame of oscillatingMergeSort.run(oscillatingMergeSort.defaultInput)) {
            expect(frame.stepNumber).toBe(index);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(Array.isArray(frame.edges)).toBe(true);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(oscillatingMergeSort.pseudocode!.length);
            expect(frame.layout).toBe("array");
            for (const entity of frame.entities) {
                expect(entity.type).toBe("bar");
                expect(VALID.has(entity.state)).toBe(true);
            }
            index += 1;
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });

    it("sorts random arrays stably against the reference sort", () => {
        let seed = 31;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const len = rand() % 14;
            const arr = Array.from({ length: len }, () => (rand() % 9) - 4);
            let last = null;
            for (const frame of oscillatingMergeSort.run([...arr])) last = frame;
            expect(last).not.toBeNull();
            const out = last!.entities.map((e) => e.value) as number[];
            expect(out).toEqual([...arr].sort((a, b) => a - b));
        }
    });
});
