/**
 * megiddo-parametric-search.test.ts - Correctness and frame-shape checks.
 */

import { describe, expect, it } from "vitest";
import megiddo from "./megiddo-parametric-search";

describe("MegiddoParametricSearch", () => {
    it("finds the k-th smallest key matching a reference sort", () => {
        let seed = 13579;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 50; t += 1) {
            const len = 1 + (rand() % 30);
            const values = Array.from({ length: len }, () => rand() % 60);
            const sorted = [...values].sort((a, b) => a - b);
            for (let k = 1; k <= len; k += 1) {
                const frames = [...megiddo.run({ values, k })];
                expect(frames.at(-1)?.meta.answer, `k=${k} of ${values.join(",")}`).toBe(sorted[k - 1]);
            }
        }
    });

    it("uses logarithmically many oracle calls", () => {
        const values = Array.from({ length: 1024 }, (_, i) => 1023 - i);
        const frames = [...megiddo.run({ values, k: 700 })];
        const calls = frames.at(-1)?.meta.calls as number;
        expect(calls).toBeLessThanOrEqual(11);
        expect(frames.at(-1)?.meta.answer).toBe(699);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...megiddo.run({ values: [9, 2, 7, 4, 1, 8, 3, 6, 5], k: 5 })];
        expect(frames.length).toBeGreaterThan(2);
        for (let i = 0; i < frames.length; i += 1) {
            const frame = frames[i];
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.layout).toBe("array");
            expect(typeof frame.meta).toBe("object");
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(megiddo.pseudocode?.length ?? 0);
        }
    });
});
