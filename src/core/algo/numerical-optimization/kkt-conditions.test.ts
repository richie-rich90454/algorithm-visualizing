/**
 * kkt-conditions.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./kkt-conditions";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], d: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(d);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function finalMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

/** Independently verify all four KKT residual families at a reported point. */
function verifyKKT(
    x: number[],
    lambda: number[],
    mu: number[],
    Q: number[][],
    c: number[],
    A: number[][],
    b: number[],
): void {
    const d = x.length;
    for (let i = 0; i < d; i += 1) {
        let g = c[i] ?? 0;
        for (let j = 0; j < d; j += 1) {
            g += (Q[i]?.[j] ?? 0) * (x[j] ?? 0);
        }
        for (let e = 0; e < A.length; e += 1) {
            g += (A[e]?.[i] ?? 0) * (lambda[e] ?? 0);
        }
        g -= mu[i] ?? 0;
        expect(Math.abs(g)).toBeLessThan(1e-6); // stationarity
        expect(x[i] ?? 0).toBeGreaterThanOrEqual(-1e-8); // primal inequality
        expect(mu[i] ?? 0).toBeGreaterThanOrEqual(-1e-8); // dual feasibility
        expect(Math.abs((mu[i] ?? 0) * (x[i] ?? 0))).toBeLessThan(1e-6); // slackness
    }
    for (let e = 0; e < A.length; e += 1) {
        let sum = 0;
        for (let i = 0; i < d; i += 1) {
            sum += (A[e]?.[i] ?? 0) * (x[i] ?? 0);
        }
        expect(Math.abs(sum - (b[e] ?? 0))).toBeLessThan(1e-6); // primal equality
    }
}

describe("KKT conditions", () => {
    it("solves the default problem and passes all four KKT checks", () => {
        const input = mod.defaultInput as {
            Q: number[][];
            c: number[];
            A: number[][];
            b: number[];
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, 2);
        const metaFrame = finalMeta(frames);
        const x = metaFrame["x"] as number[];
        expect(metaFrame["converged"]).toBe(true);
        expect(x[0]).toBeCloseTo(0.5, 5);
        expect(x[1]).toBeCloseTo(1.5, 5);
        verifyKKT(x, metaFrame["lambda"] as number[], metaFrame["mu"] as number[], input.Q, input.c, input.A, input.b);
    });

    it("activates a bound when the unconstrained projection violates it", () => {
        const input = {
            Q: [
                [2, 0],
                [0, 2],
            ],
            c: [-6, 6],
            A: [[1, 1]],
            b: [2],
            start: [0, 0],
            maxIter: 20,
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, 2);
        const metaFrame = finalMeta(frames);
        const x = metaFrame["x"] as number[];
        expect(metaFrame["converged"]).toBe(true);
        expect(x[0]).toBeCloseTo(2, 5);
        expect(x[1]).toBeCloseTo(0, 5);
        const active = metaFrame["active"] as number[];
        expect(active[1]).toBe(1);
        expect((metaFrame["mu"] as number[])[1]).toBeGreaterThan(0);
        verifyKKT(x, metaFrame["lambda"] as number[], metaFrame["mu"] as number[], input.Q, input.c, input.A, input.b);
    });

    it("reports a small max residual and terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const frame of generator) {
            count += 1;
            expect(Number(frame.meta["maxResidual"])).toBeGreaterThanOrEqual(0);
        }
        expect(count).toBeGreaterThan(1);
        expect(finalMeta([...mod.run(mod.defaultInput)])["maxResidual"] as number).toBeLessThan(1e-7);
        expect(generator.next().done).toBe(true);
    });
});
