/**
 * direct-preference-optimization.test.ts - DPO identity, reference trajectory, frame shape.
 */

import { describe, expect, it } from "vitest";
import mod from "./direct-preference-optimization";
import type { VisualFrame } from "@/types";

interface Input {
    beta: number;
    refLogOdds: number;
    startLogOdds: number;
    iterations: number;
    learningRate: number;
}

function sigmoid(z: number): number {
    return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}
function softplus(x: number): number {
    return x > 0 ? x + Math.log1p(Math.exp(-x)) : Math.log1p(Math.exp(x));
}

/** Independent replay of the scalar DPO objective. */
function reference(input: Input): Array<{ z: number; loss: number; margin: number }> {
    let z = input.startLogOdds;
    const trajectory: Array<{ z: number; loss: number; margin: number }> = [];
    for (let t = 1; t <= input.iterations; t += 1) {
        const margin = input.beta * (z - input.refLogOdds);
        const loss = softplus(-margin);
        z -= input.learningRate * (-input.beta * sigmoid(-margin));
        trajectory.push({ z, loss, margin });
    }
    return trajectory;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["loss"]).toBeTypeOf("number");
        expect(frame.meta["margin"]).toBeTypeOf("number");
        expect(Number.isFinite(frame.entities[0]?.y)).toBe(true);
    });
}

describe("Direct Preference Optimization", () => {
    it("satisfies the implicit-reward identity", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const rChosen = Number(final?.["rChosen"]);
        const rRejected = Number(final?.["rRejected"]);
        const margin = Number(final?.["margin"]);
        const z = Number(final?.["z"]);
        const beta = Number(final?.["beta"]);
        const refZ = Number(final?.["refZ"]);
        expect(rChosen - rRejected).toBeCloseTo(margin, 10);
        expect(margin).toBeCloseTo(beta * (z - refZ), 10);
        expect(Number(final?.["loss"])).toBeCloseTo(softplus(-margin), 10);
    });

    it("matches an independent reference and reduces the loss", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        for (let t = 1; t <= input.iterations; t += 1) {
            const frame = frames[t]?.meta;
            expect(Number(frame?.["z"])).toBeCloseTo(expected[t - 1]?.z ?? 0, 10);
            expect(Number(frame?.["loss"])).toBeCloseTo(expected[t - 1]?.loss ?? 0, 10);
        }
        const first = Number(frames[0]?.meta["loss"]);
        const last = Number(frames[frames.length - 1]?.meta["loss"]);
        expect(last).toBeLessThan(first);
        expect(Number(frames[frames.length - 1]?.meta["accuracy"])).toBeGreaterThan(0.5);
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
