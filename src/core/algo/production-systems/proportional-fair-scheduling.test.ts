/** proportional-fair-scheduling.test.ts - Brute-force argmax reference, fairness property, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { pfArgmax, pfStep } from "./proportional-fair-scheduling";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Proportional Fair Scheduling", () => {
    it("picks the brute-force maximum ratio on random inputs", () => {
        for (let trial = 0; trial < 200; trial += 1) {
            const users = 2 + (trial % 6);
            const rates = Array.from({ length: users }, (_, i) => ((trial * (i + 3) + i * i) % 17) + 1);
            const averages = Array.from({ length: users }, (_, i) => ((trial + i * 5) % 9) + 1);
            let expected = 0;
            for (let i = 1; i < users; i += 1) {
                if (rates[i]! / averages[i]! > rates[expected]! / averages[expected]!) expected = i;
            }
            expect(pfArgmax(rates, averages)).toBe(expected);
        }
    });

    it("matches an independent running-average reference", () => {
        for (let trial = 0; trial < 20; trial += 1) {
            const window = 2 + (trial % 6);
            let averages = Array.from({ length: 4 }, (_, i) => i + 1);
            for (let slot = 0; slot < 15; slot += 1) {
                const rates = Array.from({ length: 4 }, (_, i) => 1 + ((trial * i + slot * (i + 2)) % 11));
                const expectedServed = pfArgmax(rates, averages);
                const expectedNext = averages.map((a, i) =>
                    (1 - 1 / window) * a + (i === expectedServed ? (1 / window) * rates[i]! : 0));
                const result = pfStep(slot, rates, averages, window);
                expect(result.step.served).toBe(expectedServed);
                result.averages.forEach((a, i) => expect(a).toBeCloseTo(expectedNext[i]!, 10));
                expect(averages.every((a) => a > 0)).toBe(true);
                averages = result.averages;
            }
        }
    });

    it("eventually serves every user with a positive rate", () => {
        const rates = Array.from({ length: 60 }, () => [8, 4, 2, 1]);
        let averages = [1e-6, 1e-6, 1e-6, 1e-6];
        const counts = [0, 0, 0, 0];
        for (let slot = 0; slot < rates.length; slot += 1) {
            const result = pfStep(slot, rates[slot]!, averages, 3);
            averages = result.averages;
            counts[result.step.served]! += 1;
        }
        expect(counts.every((c) => c > 0)).toBe(true);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        expect(final["done"]).toBe(true);
        expect((final["counts"] as number[]).reduce((a, b) => a + b, 0)).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
