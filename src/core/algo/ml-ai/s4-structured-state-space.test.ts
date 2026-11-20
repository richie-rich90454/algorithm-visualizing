/**
 * s4-structured-state-space.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./s4-structured-state-space";
import type { VisualFrame } from "@/types";

/** Independent unrolled-convolution reference for the discretized SSM. */
function reference(meta: Record<string, unknown>): number[] {
    const N = Number(meta["N"]);
    const T = Number(meta["T"]);
    const dt = Number(meta["dt"]);
    const A = meta["A"] as number[];
    const B = meta["B"] as number[];
    const C = meta["C"] as number[];
    const D = Number(meta["D"]);
    const u = meta["u"] as number[];
    const Abar = A.map((a) => Math.exp(a * dt));
    const Bbar = A.map((a, i) => ((B[i] ?? 0) * ((Abar[i] ?? 0) - 1)) / a);
    const y: number[] = [];
    for (let t = 0; t < T; t += 1) {
        let value = D * (u[t] ?? 0);
        for (let i = 0; i < N; i += 1) {
            let convolution = 0;
            for (let s = 0; s <= t - 1; s += 1) {
                convolution += Math.pow(Abar[i] ?? 0, t - 1 - s) * (Bbar[i] ?? 0) * (u[s] ?? 0);
            }
            value += (C[i] ?? 0) * convolution;
        }
        y.push(value);
    }
    return y;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("S4 Structured State Space (Recurrence)", () => {
    it("matches an independent unrolled convolution", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta ?? {};
        const expected = reference(final);
        const y = final["ySequence"] as number[];
        expect(y.length).toBe(expected.length);
        y.forEach((value, index) => expect(value).toBeCloseTo(expected[index] ?? 0, 9));
    });

    it("keeps the Abar and Bbar discretization consistent with the report", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta ?? {};
        const A = final["A"] as number[];
        const dt = Number(final["dt"]);
        const B = final["B"] as number[];
        const Abar = final["Abar"] as number[];
        const Bbar = final["Bbar"] as number[];
        A.forEach((a, i) => {
            expect(Abar[i]).toBeCloseTo(Math.exp(a * dt), 12);
            expect(Bbar[i]).toBeCloseTo(((B[i] ?? 0) * ((Abar[i] ?? 0) - 1)) / a, 9);
        });
    });

    it("matches reference across several state sizes", () => {
        for (const stateSize of [1, 2, 6]) {
            const frames = [...mod.run({ stateSize, steps: 5, dt: 0.07, seed: 3 })];
            const final = frames[frames.length - 1]?.meta ?? {};
            const expected = reference(final);
            (final["ySequence"] as number[]).forEach((value, index) => {
                expect(value).toBeCloseTo(expected[index] ?? 0, 8);
            });
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
