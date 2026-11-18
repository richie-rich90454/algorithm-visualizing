/** lasso-regression.test.ts - Correctness and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./lasso-regression";
import type { VisualFrame } from "@/types";

interface Input {
    X: number[][];
    y: number[];
    lambda: number;
    sweeps: number;
}

function soft(value: number, lambda: number): number {
    if (value > lambda) {
        return value - lambda;
    }
    if (value < -lambda) {
        return value + lambda;
    }
    return 0;
}

/** Brute-force coordinate descent reference. */
function reference(input: Input) {
    const d = input.X[0]!.length;
    const w = new Array<number>(d).fill(0);
    for (let sweep = 0; sweep < input.sweeps; sweep += 1) {
        for (let j = 0; j < d; j += 1) {
            let rho = 0;
            let z = 0;
            for (let i = 0; i < input.y.length; i += 1) {
                let partial = 0;
                for (let k = 0; k < d; k += 1) {
                    if (k !== j) {
                        partial += input.X[i]![k]! * w[k]!;
                    }
                }
                rho += input.X[i]![j]! * (input.y[i]! - partial);
                z += input.X[i]![j]! ** 2;
            }
            w[j] = z > 0 ? soft(rho, input.lambda) / z : 0;
        }
    }
    return w;
}

function checkFrames(frames: VisualFrame[], featureCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(featureCount);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Lasso regression", () => {
    it("matches a brute-force coordinate descent reference", () => {
        const cases: Input[] = [
            { X: [[1, 0], [0, 1], [1, 1], [2, 1]], y: [1, 2, 3, 5], lambda: 0.5, sweeps: 4 },
            { X: [[2, 1], [1, 3], [4, 2], [3, 3]], y: [3, 5, 9, 8], lambda: 1.2, sweeps: 6 },
            { X: [[1, 2, 3], [2, 0, 1], [0, 1, 2]], y: [4, 1, 3], lambda: 0.2, sweeps: 5 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.X[0]!.length);
            const expected = reference(input);
            const finalW = frames[frames.length - 1]?.meta["w"] as number[];
            expect(finalW.length).toBe(expected.length);
            expected.forEach((value, index) => {
                expect(finalW[index]).toBeCloseTo(value, 4);
            });
        }
    });

    it("produces sparse weights for a very large penalty", () => {
        const frames = [...mod.run({ X: [[1, 0], [0, 1], [1, 1]], y: [1, 2, 3], lambda: 100, sweeps: 3 })];
        const finalW = frames[frames.length - 1]?.meta["w"] as number[];
        expect(finalW.every((v) => v === 0)).toBe(true);
    });

    it("never increases the objective across updates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (let i = 1; i < frames.length; i += 1) {
            const previous = Number(frames[i - 1]?.meta["objective"]);
            const current = Number(frames[i]?.meta["objective"]);
            expect(current).toBeLessThanOrEqual(previous + 1e-9);
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
