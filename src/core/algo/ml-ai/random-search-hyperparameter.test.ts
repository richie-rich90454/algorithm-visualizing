/** random-search-hyperparameter.test.ts - Property checks, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { mulberry32, randomSearch, sphereObjective } from "./random-search-hyperparameter";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Random Search Hyperparameter Tuning", () => {
    it("best result matches a brute-force scan of the sampled history", () => {
        const center = [1.5, -1.5];
        const result = randomSearch(center, [-2, 2], 40, 7);
        const bruteBest = Math.min(...result.history.map((h) => h.value));
        expect(result.bestValue).toBeCloseTo(bruteBest, 12);
        const bruteConfig = result.history.find((h) => h.value === bruteBest)!.config;
        expect(bruteConfig.join(",")).toBe(result.bestConfig.join(","));
    });

    it("respects bounds and reproduces trials for the same seed", () => {
        const a = randomSearch([1, -1], [-3, 3], 20, 123);
        const b = randomSearch([1, -1], [-3, 3], 20, 123);
        expect(a.history.map((h) => h.config.join(","))).toEqual(
            b.history.map((h) => h.config.join(",")),
        );
        for (const sample of a.history) {
            for (const x of sample.config) {
                expect(x).toBeGreaterThanOrEqual(-3);
                expect(x).toBeLessThanOrEqual(3);
            }
        }
        const rand = mulberry32(123);
        const expected = [-3 + rand() * 6, -3 + rand() * 6];
        expect(a.history[0]!.config[0]).toBeCloseTo(expected[0]!, 12);
        expect(a.history[0]!.config[1]).toBeCloseTo(expected[1]!, 12);
    });

    it("objective equals an explicit squared-distance computation", () => {
        const config = [1, 2, 3];
        const center = [0, 0, 0];
        expect(sphereObjective(config, center)).toBe(14);
    });

    it("produces well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!;
        expect(final.meta["converged"]).toBe(true);
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe(frames.length);
        expect(gen.next().done).toBe(true);
    });
});
