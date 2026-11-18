/**
 * admm.test.ts - Closed-form optimum, soft-threshold property, residual checks,
 * frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./admm";
import type { VisualFrame } from "@/types";

function soft(v: number, kappa: number): number {
    if (v > kappa) {
        return v - kappa;
    }
    if (v < -kappa) {
        return v + kappa;
    }
    return 0;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3 * n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("ADMM", () => {
    it("reaches the closed-form optimum of the diagonal problem", () => {
        const input = mod.defaultInput as {
            diagonal: number[]; b: number[]; lambda: number; rho: number;
        };
        const frames = [...mod.run({ ...input, iterations: 200 })];
        checkFrames(frames, input.b.length);
        const final = frames[frames.length - 1]?.meta;
        const x = final?.["x"] as number[];
        const expected = input.b.map((value, i) => {
            const scale = input.diagonal[i] ?? 0;
            return soft(value, input.lambda / (scale * scale));
        });
        for (let i = 0; i < x.length; i += 1) {
            expect(x[i]).toBeCloseTo(expected[i]!, 5);
        }
        expect(final?.["converged"]).toBe(true);
    });

    it("satisfies the soft-threshold update and residual definitions at each step", () => {
        const input = mod.defaultInput as { lambda: number; rho: number; diagonal: number[]; b: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.b.length);
        const threshold = input.lambda / input.rho;
        let previousObjective = Infinity;
        for (const frame of frames) {
            const x = frame.meta["x"] as number[];
            const z = frame.meta["z"] as number[];
            const u = frame.meta["u"] as number[];
            for (let i = 0; i < x.length; i += 1) {
                expect(z[i]).toBeCloseTo(soft((x[i] ?? 0) + (u[i] ?? 0), threshold), 10);
            }
            const primal = Math.sqrt(
                x.reduce((sum, value, i) => sum + (value - (z[i] ?? 0)) ** 2, 0),
            );
            expect(Number(frame.meta["primalResidual"])).toBeCloseTo(primal, 10);
            const objective = Number(frame.meta["objective"]);
            expect(objective).toBeLessThanOrEqual(previousObjective + 1e-9);
            previousObjective = objective;
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
