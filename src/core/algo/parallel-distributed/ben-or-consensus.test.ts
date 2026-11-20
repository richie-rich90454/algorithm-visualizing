/**
 * ben-or-consensus.test.ts - Agreement, validity, termination, and frames.
 */

import { describe, expect, it } from "vitest";
import mod from "./ben-or-consensus";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Ben-Or consensus", () => {
    it("reaches agreement and preserves validity on all odd-size inputs", () => {
        for (const n of [3, 5]) {
            for (let mask = 0; mask < 2 ** n; mask += 1) {
                const inputs = Array.from({ length: n }, (_, i) => (mask >> i) & 1);
                const uniform = inputs.every((v) => v === inputs[0]);
                const frames = [...mod.run({ inputs, seed: 7, maxRounds: 12 })];
                checkFrames(frames);
                const final = frames[frames.length - 1]?.meta;
                const estimates = final?.["estimates"] as number[];
                expect(new Set(estimates).size).toBe(1);
                expect(final?.["converged"]).toBe(true);
                if (uniform) {
                    expect(final?.["decision"]).toBe(inputs[0]);
                }
            }
        }
    });

    it("converges on split even-size inputs for several seeds", () => {
        for (const seed of [1, 2, 3, 5, 7, 11, 13, 17]) {
            const frames = [...mod.run({ inputs: [0, 0, 1, 1], seed, maxRounds: 30 })];
            const final = frames[frames.length - 1]?.meta;
            expect(new Set(final?.["estimates"] as number[]).size).toBe(1);
            expect(final?.["converged"]).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
