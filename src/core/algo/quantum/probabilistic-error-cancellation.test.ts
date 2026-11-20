/**
 * probabilistic-error-cancellation.test.ts - Signed-decomposition reference, unbiasedness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./probabilistic-error-cancellation";
import type { VisualFrame } from "@/types";

function reference(p: number, axis: string) {
    const inv = -p / (1 - p);
    const quasi = [1 - (3 * inv) / 4, inv / 4, inv / 4, inv / 4];
    const gamma = quasi.reduce((s, q) => s + Math.abs(q), 0);
    const initial: Record<string, [number, number, number]> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
    const v = initial[axis]!;
    const noisy = v.map((c) => c * (1 - p)) as [number, number, number];
    const component = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    const branches = [
        noisy[component],
        apply("X", noisy)[component],
        apply("Y", noisy)[component],
        apply("Z", noisy)[component],
    ];
    const corrected = quasi.reduce((s, q, i) => s + q * branches[i]!, 0);
    return { quasi, gamma, corrected, noisy: noisy[component] };
}

function apply(gate: string, v: [number, number, number]): [number, number, number] {
    if (gate === "X") return [v[0], -v[1], -v[2]];
    if (gate === "Y") return [-v[0], v[1], -v[2]];
    if (gate === "Z") return [-v[0], -v[1], v[2]];
    return [...v] as [number, number, number];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(6);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(5 * 5);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect((frame.meta["quasiProbs"] as number[]).length).toBe(4);
    });
}

describe("ProbabilisticErrorCancellation", () => {
    it("matches an independent signed decomposition reference", () => {
        for (const p of [0, 0.05, 0.2, 0.5, 0.8]) {
            for (const axis of ["x", "y", "z"]) {
                const frames = [...mod.run({ p, axis })];
                checkFrames(frames);
                const expected = reference(p, axis);
                const final = frames[frames.length - 1]?.meta;
                (final?.["quasiProbs"] as number[]).forEach((q, i) => expect(q).toBeCloseTo(expected.quasi[i]!, 12));
                expect(final?.["gamma"] as number).toBeCloseTo(expected.gamma, 12);
                expect(final?.["noisy"] as number).toBeCloseTo(expected.noisy, 12);
                expect(final?.["corrected"] as number).toBeCloseTo(expected.corrected, 12);
            }
        }
    });

    it("is unbiased for every Pauli eigenstate", () => {
        for (const axis of ["x", "y", "z"]) {
            const final = [...mod.run({ p: 0.3, axis })].pop()?.meta;
            expect(final?.["corrected"] as number).toBeCloseTo(1, 10);
            expect(final?.["ideal"] as number).toBe(1);
            expect(final?.["corrected"] as number).toBeGreaterThan(final?.["noisy"] as number);
        }
    });

    it("produces negative quasi-probabilities and normalized sampling weights", () => {
        const final = [...mod.run({ p: 0.2, axis: "z" })].pop()?.meta;
        expect(final?.["negativeCount"]).toBe(3);
        const quasi = final?.["quasiProbs"] as number[];
        expect(quasi[0]).toBeGreaterThan(0);
        expect(quasi.reduce((s, q) => s + q, 0)).toBeCloseTo(1, 12);
        const probs = final?.["sampleProbs"] as number[];
        expect(probs.reduce((s, q) => s + q, 0)).toBeCloseTo(1, 12);
        probs.forEach((prob) => expect(prob).toBeGreaterThanOrEqual(0));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
