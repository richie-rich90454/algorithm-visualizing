/**
 * elastic-net.test.ts - Independent objective computation, monotone descent,
 * orthogonal-design closed form, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./elastic-net";
import type { VisualFrame } from "@/types";

function objective(X: number[][], y: number[], w: number[], l1: number, l2: number): number {
    let total = 0;
    for (let i = 0; i < y.length; i += 1) {
        let prediction = 0;
        for (let j = 0; j < w.length; j += 1) prediction += (X[i]?.[j] ?? 0) * (w[j] ?? 0);
        const residual = (y[i] ?? 0) - prediction;
        total += 0.5 * residual * residual;
    }
    for (const value of w) total += l1 * Math.abs(value) + 0.5 * l2 * value * value;
    return total;
}

function soft(v: number, l1: number): number {
    if (v > l1) return v - l1;
    if (v < -l1) return v + l1;
    return 0;
}

function referenceFit(X: number[][], y: number[], l1: number, l2: number, sweeps: number, d: number): number[] {
    const w = new Array<number>(d).fill(0);
    for (let s = 0; s < sweeps; s += 1) {
        for (let j = 0; j < d; j += 1) {
            let rho = 0;
            let z = 0;
            for (let i = 0; i < y.length; i += 1) {
                const xij = X[i]?.[j] ?? 0;
                let partial = 0;
                for (let k = 0; k < d; k += 1) if (k !== j) partial += (X[i]?.[k] ?? 0) * (w[k] ?? 0);
                rho += xij * ((y[i] ?? 0) - partial);
                z += xij * xij;
            }
            w[j] = (z + l2) > 0 ? soft(rho, l1) / (z + l2) : 0;
        }
    }
    return w;
}

function checkFrames(frames: VisualFrame[], d: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(d);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["objective"]).toBeDefined();
    });
}

describe("ElasticNet", () => {
    it("matches an independent coordinate-descent replay and objective", () => {
        const input = mod.defaultInput as { X: number[][]; y: number[]; lambda1: number; lambda2: number; sweeps: number };
        const frames = [...mod.run(input)];
        const d = input.X[0]?.length ?? 0;
        checkFrames(frames, d);
        const final = frames[frames.length - 1]?.meta;
        const expected = referenceFit(input.X, input.y, input.lambda1, input.lambda2, input.sweeps, d);
        const actual = final?.["w"] as number[];
        actual.forEach((v, i) => expect(Math.abs(v - (expected[i] ?? 0))).toBeLessThan(1e-6));
        expect(Math.abs((final?.["objective"] as number) - objective(input.X, input.y, expected, input.lambda1, input.lambda2))).toBeLessThan(1e-5);
    });

    it("never increases the objective from one update to the next", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const objectives = frames.map((frame) => frame.meta["objective"] as number);
        for (let i = 1; i < objectives.length; i += 1) {
            expect(objectives[i] ?? 0).toBeLessThanOrEqual((objectives[i - 1] ?? 0) + 1e-9);
        }
    });

    it("recovers the closed form on an orthogonal design", () => {
        const X = [[1, 0], [0, 1]];
        const y = [2, 0.2];
        const lambda1 = 0.3;
        const lambda2 = 0.5;
        const final = [...mod.run({ X, y, lambda1, lambda2, sweeps: 3 })].pop()?.meta;
        const w = final?.["w"] as number[];
        expect(w[0]).toBeCloseTo(soft(2, lambda1) / (1 + lambda2), 5);
        expect(w[1]).toBe(0);
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
