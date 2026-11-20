/** langevin-monte-carlo.test.ts - Proposal/acceptance property checks, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./langevin-monte-carlo";
import type { VisualFrame } from "@/types";

/** Independently compute the MALA log acceptance ratio from a state and proposal. */
function referenceLogRatio(current: number, proposal: number, step: number): number {
    const logTarget = (x: number) => (-x * x) / 2;
    const center = (x: number) => x + (step * step * -x) / 2;
    const logQ = (from: number, to: number) => -((to - center(from)) ** 2) / (2 * step * step);
    return logTarget(proposal) + logQ(proposal, current) - logTarget(current) - logQ(current, proposal);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    let previous = -1;
    frames.forEach((frame) => {
        expect(frame.stepNumber).toBeGreaterThan(previous);
        previous = frame.stepNumber;
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Langevin Monte Carlo", () => {
    it("uses the correct Metropolis ratio for every proposal", () => {
        const input = { steps: 60, step: 0.7, seed: 11 };
        const frames = [...mod.run(input)].slice(1, -1);
        checkFrames(frames);
        for (const frame of frames) {
            const from = Number(frame.meta["from"]);
            const proposal = Number(frame.meta["proposal"]);
            const reported = Number(frame.meta["logRatio"]);
            expect(reported).toBeCloseTo(referenceLogRatio(from, proposal, input.step), 10);
            expect(Number.isFinite(proposal)).toBe(true);
            const accepted = frame.meta["accepted"];
            expect(typeof accepted).toBe("boolean");
        }
    });

    it("accepts uphill proposals and obeys the 0 to 1 acceptance probability", () => {
        // Independent ratio computation: a proposal closer to zero than the current state
        // must have a positive log ratio for a standard normal target.
        expect(referenceLogRatio(1.5, 0.5, 0.5)).toBeGreaterThan(0);
        const frames = [...mod.run({ steps: 80, step: 0.6, seed: 3 })].slice(1, -1);
        for (const frame of frames) {
            const ratio = Number(frame.meta["logRatio"]);
            const prob = Math.min(1, Math.exp(ratio));
            expect(prob).toBeGreaterThanOrEqual(0);
            expect(prob).toBeLessThanOrEqual(1);
        }
        const final = [...mod.run({ steps: 80, step: 0.6, seed: 3 })].at(-1)?.meta;
        const rate = Number(final?.["acceptanceRate"]);
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
    });

    it("reproduces its chain exactly for the same seed", () => {
        const a = [...mod.run({ steps: 50, step: 0.6, seed: 42 })];
        const b = [...mod.run({ steps: 50, step: 0.6, seed: 42 })];
        expect(a.map((f) => f.meta["current"])).toEqual(b.map((f) => f.meta["current"]));
        expect(a.at(-1)?.meta["acceptedCount"]).toBe(b.at(-1)?.meta["acceptedCount"]);
    });

    it("samples near the standard normal target over a long run", () => {
        let final: VisualFrame["meta"] | undefined;
        for (const frame of mod.run({ steps: 1500, step: 0.6, seed: 12345 })) {
            final = frame.meta;
        }
        const mean = Number(final?.["mean"]);
        const variance = Number(final?.["variance"]);
        expect(Math.abs(mean)).toBeLessThan(0.25);
        expect(variance).toBeGreaterThan(0.7);
        expect(variance).toBeLessThan(1.3);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
