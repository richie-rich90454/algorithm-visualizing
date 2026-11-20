/** stochastic-depth.test.ts - Expectation, boundary, frame, and termination checks. */

import { describe, expect, it } from "vitest";
import mod, {
    expectedDepth,
    stochasticDepthSample,
    survivalSchedule,
} from "./stochastic-depth";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], bars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(bars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]).toContain(
            frame.entities[0]!.state,
        );
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Stochastic Depth", () => {
    it("Monte Carlo mean active depth approaches the sum of probabilities", () => {
        const probs = [1, 0.8, 0.6, 0.4, 0.2, 0];
        let total = 0;
        const trials = 4000;
        for (let s = 0; s < trials; s += 1) {
            total += stochasticDepthSample(probs, s).depth;
        }
        expect(total / trials).toBeCloseTo(expectedDepth(probs), 1);
    });

    it("respects probability boundaries and the linear schedule", () => {
        expect(stochasticDepthSample([0, 0, 0], 1).depth).toBe(0);
        expect(stochasticDepthSample([1, 1, 1], 1).depth).toBe(3);
        expect(expectedDepth([0.5, 0.25])).toBeCloseTo(0.75, 10);
        const schedule = survivalSchedule(5, 0.5);
        expect(schedule[0]).toBeCloseTo(0.5, 10);
        expect(schedule[4]).toBeCloseTo(1, 10);
    });

    it("produces well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 8);
        const final = frames[frames.length - 1]!;
        expect(final.meta["converged"]).toBe(true);
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe(frames.length);
        expect(gen.next().done).toBe(true);
    });
});
