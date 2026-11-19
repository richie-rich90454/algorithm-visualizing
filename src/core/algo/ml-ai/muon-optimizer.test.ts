/** muon-optimizer.test.ts - Independent replay, scale invariance, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./muon-optimizer";
import type { VisualFrame } from "@/types";

interface Input {
    parameters: number[][];
    gradients: number[][][];
    learningRate: number;
    momentum: number;
    iterations: number;
}

function mm(a: number[][], b: number[][]): number[][] {
    return [
        [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
        [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
    ];
}

function reference(input: Input): number[][] {
    const theta = input.parameters.map((row) => row.slice());
    let m = [
        [0, 0],
        [0, 0],
    ];
    for (const g of input.gradients) {
        m = m.map((row, i) => row.map((v, j) => input.momentum * v + g[i][j]));
        let normSq = 0;
        for (const row of m) {
            for (const v of row) {
                normSq += v * v;
            }
        }
        const norm = Math.sqrt(normSq);
        let x = norm > 0 ? m.map((row) => row.map((v) => v / norm)) : m;
        for (let k = 0; k < input.iterations; k += 1) {
            const xt = [
                [x[0][0], x[1][0]],
                [x[0][1], x[1][1]],
            ];
            const product = mm(mm(x, xt), x);
            x = x.map((row, i) => row.map((v, j) => 1.5 * v - 0.5 * product[i][j]));
        }
        for (let i = 0; i < 2; i += 1) {
            for (let j = 0; j < 2; j += 1) {
                theta[i][j] -= input.learningRate * x[i][j];
            }
        }
    }
    return theta;
}

function checkFrames(frames: VisualFrame[], cells: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(cells);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Muon Optimizer", () => {
    const input: Input = {
        parameters: [
            [1, -0.5],
            [0.5, -1],
        ],
        gradients: [
            [
                [0.9, -0.3],
                [0.4, -0.7],
            ],
            [
                [0.5, -0.2],
                [0.2, -0.4],
            ],
            [
                [0.2, -0.1],
                [0.1, -0.2],
            ],
        ],
        learningRate: 0.05,
        momentum: 0.9,
        iterations: 6,
    };

    it("matches an independent Newton-Schulz replay", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, 4);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta["parameters"] as number[];
        for (let i = 0; i < 2; i += 1) {
            for (let j = 0; j < 2; j += 1) {
                expect(final[i * 2 + j]).toBeCloseTo(expected[i][j], 10);
            }
        }
    });

    it("is invariant to scaling all gradients", () => {
        const doubled: Input = {
            ...input,
            gradients: input.gradients.map((g) => g.map((row) => row.map((v) => 2 * v))),
        };
        const base = [...mod.run(input)];
        const scaled = [...mod.run(doubled)];
        const a = base[base.length - 1]?.meta["parameters"] as number[];
        const b = scaled[scaled.length - 1]?.meta["parameters"] as number[];
        for (let i = 0; i < 4; i += 1) {
            expect(b[i]).toBeCloseTo(a[i], 10);
        }
    });

    it("drives the orthogonality residual near zero", () => {
        const frames = [...mod.run(input)];
        const steps = frames.slice(1, -1);
        expect(steps.length).toBeGreaterThan(0);
        for (const frame of steps) {
            const error = Number(frame.meta["orthogonalResidual"]);
            expect(error).toBeGreaterThanOrEqual(0);
            expect(error).toBeLessThan(0.05);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(input.gradients.length + 2);
        expect(generator.next().done).toBe(true);
    });
});
