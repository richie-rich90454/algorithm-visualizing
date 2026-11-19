/**
 * preconditioner-ilu.test.ts - ILU(0) pattern and reconstruction properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./preconditioner-ilu";
import type { VisualFrame } from "@/types";

function square(values: number[], n: number): number[][] {
    return Array.from({ length: n }, (_, i) => values.slice(i * n, i * n + n));
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["rows"]).toBe(n);
        expect(frame.meta["cols"]).toBe(n);
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        frame.entities.forEach((e) => expect(Number.isFinite(e.value as number)).toBe(true));
    });
}

describe("IncompleteLU", () => {
    it("matches A on every original pattern entry and never stores fill", () => {
        for (const side of [1, 2, 3]) {
            const n = side * side;
            const frames = [...mod.run({ side })];
            checkFrames(frames, n);
            const final = frames[frames.length - 1]?.meta;
            const L = square(final?.["L"] as number[], n);
            const U = square(final?.["U"] as number[], n);
            const A = square(final?.["A"] as number[], n);
            const pattern = square(final?.["pattern"] as number[], n);

            for (let i = 0; i < n; i += 1) {
                expect(L[i]![i]).toBe(1);
                for (let j = 0; j < n; j += 1) {
                    if (!pattern[i]?.[j]) {
                        expect(L[i]![j]).toBe(0);
                        expect(U[i]![j]).toBe(0);
                    }
                    let product = 0;
                    for (let k = 0; k < n; k += 1) product += L[i]![k]! * U[k]![j]!;
                    if (pattern[i]?.[j]) expect(product).toBeCloseTo(A[i]![j]!, 8);
                }
            }
            expect(final?.["patternResidual"] as number).toBeLessThan(1e-8);
        }
    });

    it("drops fill for a nontrivial stencil", () => {
        const frames = [...mod.run({ side: 3 })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["dropped"] as number).toBeGreaterThan(0);
        expect(final?.["patternSize"] as number).toBeGreaterThan(9);
    });

    it("produces finite factors for every pivot", () => {
        const frames = [...mod.run({ side: 3 })];
        for (const frame of frames) {
            const L = square(frame.meta["L"] as number[], 9);
            const U = square(frame.meta["U"] as number[], 9);
            L.forEach((row) => row.forEach((v) => expect(Number.isFinite(v)).toBe(true)));
            U.forEach((row) => row.forEach((v) => expect(Number.isFinite(v)).toBe(true)));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(10);
        expect(generator.next().done).toBe(true);
    });
});
