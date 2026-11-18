/**
 * bayes-theorem.test.ts - Population enumeration, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bayes-theorem";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(6);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(3);
        expect(frame.meta["cols"]).toBe(2);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Count a large synthetic population instead of using the formula. */
function enumerate(prior: number, likelihood: number, falsePositive: number) {
    const total = 200000;
    const withCondition = Math.round(prior * total);
    const withoutCondition = total - withCondition;
    const positiveWith = Math.round(likelihood * withCondition);
    const positiveWithout = Math.round(falsePositive * withoutCondition);
    return {
        posterior: positiveWith / (positiveWith + positiveWithout),
        evidence: (positiveWith + positiveWithout) / total,
    };
}

describe("BayesTheorem", () => {
    it("agrees with population enumeration on several parameter sets", () => {
        const cases: Array<[number, number, number]> = [
            [0.01, 0.95, 0.05],
            [0.5, 0.8, 0.2],
            [0.3, 0.7, 0.4],
            [0.001, 0.99, 0.01],
        ];
        for (const [prior, likelihood, falsePositive] of cases) {
            const frames = [...mod.run({ prior, likelihood, falsePositive })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const brute = enumerate(prior, likelihood, falsePositive);
            expect(Number(meta?.["posterior"])).toBeCloseTo(brute.posterior, 3);
            expect(Number(meta?.["evidence"])).toBeCloseTo(brute.evidence, 4);
        }
    });

    it("keeps complementary posteriors summing to one", () => {
        const prior = 0.2;
        const likelihood = 0.9;
        const falsePositive = 0.1;
        const frames = [...mod.run({ prior, likelihood, falsePositive })];
        checkFrames(frames);
        const posterior = Number(frames[frames.length - 1]?.meta["posterior"]);
        const complementPosterior =
            (falsePositive * (1 - prior)) /
            (likelihood * prior + falsePositive * (1 - prior));
        expect(posterior + complementPosterior).toBeCloseTo(1, 12);
    });

    it("returns zero posterior when the evidence probability is zero", () => {
        const frames = [...mod.run({ prior: 0.5, likelihood: 0, falsePositive: 0 })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["posterior"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(3);
        expect(generator.next().done).toBe(true);
    });
});
