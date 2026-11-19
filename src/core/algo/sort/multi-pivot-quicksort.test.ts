/**
 * multi-pivot-quicksort.test.ts - Correctness and frame-shape checks.
 */

import { describe, expect, it } from "vitest";
import multiPivot from "./multi-pivot-quicksort";

describe("MultiPivotQuickSort", () => {
    it("sorts random arrays with several pivot counts like the reference sort", () => {
        let seed = 987;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 50; t += 1) {
            const len = 1 + (rand() % 25);
            const arr = Array.from({ length: len }, () => rand() % 50 - 25);
            const k = 1 + (rand() % 5);
            const expected = [...arr].sort((a, b) => a - b);
            const frames = [...multiPivot.run({ array: arr, k })];
            const finalValues = frames.at(-1)?.entities.map((e) => e.value);
            expect(finalValues, `failed k=${k} on ${arr.join(",")}`).toEqual(expected);
        }
    });

    it("sorts duplicate-heavy and already sorted inputs", () => {
        const cases = [
            [4, 4, 4, 4],
            [1, 2, 3, 4, 5],
            [5, 4, 3, 2, 1],
            [2, 1, 2, 1, 2, 1],
        ];
        for (const arr of cases) {
            const expected = [...arr].sort((a, b) => a - b);
            const frames = [...multiPivot.run(arr)];
            expect(frames.at(-1)?.entities.map((e) => e.value)).toEqual(expected);
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...multiPivot.run({ array: [8, 3, 9, 1, 6, 2, 7, 4, 5], k: 3 })];
        expect(frames.length).toBeGreaterThan(3);
        for (let i = 0; i < frames.length; i += 1) {
            const frame = frames[i];
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.layout).toBe("array");
            expect(typeof frame.meta).toBe("object");
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(multiPivot.pseudocode?.length ?? 0);
        }
    });
});
