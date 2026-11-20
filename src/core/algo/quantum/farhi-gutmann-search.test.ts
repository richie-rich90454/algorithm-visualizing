/**
 * farhi-gutmann-search.test.ts - Probability conservation, peak near one,
 * independent full-graph matrix-exponential cross-check, frame shape, and
 * termination.
 */

import { describe, expect, it } from "vitest";
import mod, { bruteMarkedProbability } from "./farhi-gutmann-search";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Farhi-Gutmann continuous-time search", () => {
    it("concentrates probability on the marked vertex near the search time", () => {
        for (const N of [8, 16, 36]) {
            const frames = [...mod.run({ vertices: N, samples: 41 })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!.meta;
            expect(Number(last["bestProbability"])).toBeGreaterThan(0.99);
            const tStar = Number(last["tStar"]);
            expect(tStar).toBeGreaterThan(0);
        }
    });

    it("conserves total probability at every sampled time", () => {
        const frames = [...mod.run({ vertices: 16, samples: 21 })];
        checkFrames(frames);
        for (const frame of frames.slice(1, -1)) {
            expect(Number(frame.meta["totalProbability"])).toBeCloseTo(1, 9);
        }
    });

    it("matches an independent full-graph matrix exponential for small N", () => {
        const N = 8;
        const gamma = 1 / N;
        const frames = [...mod.run({ vertices: N, samples: 13 })];
        checkFrames(frames);
        const times = frames[0]!.meta["times"] as number[];
        const pMarked = frames[0]!.meta["pMarked"] as number[];
        for (let i = 0; i < times.length; i += 1) {
            const brute = bruteMarkedProbability(N, gamma, times[i]!, 0);
            expect(pMarked[i]!).toBeCloseTo(brute, 4);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
