/**
 * consistency-model.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./consistency-model";
import type { VisualFrame } from "@/types";

function predict(theta: number[], x: number, t: number): number {
    return (theta[0] ?? 0) * x + (theta[1] ?? 0) * t + (theta[2] ?? 0);
}

function loss(theta: number[], xs: number[], ts: number[]): number {
    let total = 0;
    for (let k = 0; k + 1 < ts.length; k += 1) {
        const diff = predict(theta, xs[k + 1] ?? 0, ts[k + 1] ?? 0) - predict(theta, xs[k] ?? 0, ts[k] ?? 0);
        total += diff * diff;
    }
    return total;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Consistency Model (Distillation Step)", () => {
    it("predictions and losses match an independent recomputation", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta ?? {};
        const xs = final["xs"] as number[];
        const ts = final["levels"] as number[];
        const thetaAfter = final["thetaAfter"] as number[];
        const fAfter = final["fAfter"] as number[];
        fAfter.forEach((value, index) => {
            expect(value).toBeCloseTo(predict(thetaAfter, xs[index] ?? 0, ts[index] ?? 0), 9);
        });
        expect(Number(final["lossAfter"])).toBeCloseTo(loss(thetaAfter, xs, ts), 9);
    });

    it("strictly lowers the self-consistency loss", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta ?? {};
        const before = Number(final["lossBefore"]);
        const after = Number(final["lossAfter"]);
        expect(after).toBeLessThan(before);
        expect(after).toBeGreaterThanOrEqual(0);
    });

    it("keeps the reported initial parameters stable across frames", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const firstTheta = frames[0]?.meta["thetaBefore"] as number[];
        const midTheta = frames[1]?.meta["thetaBefore"] as number[];
        expect(firstTheta).toEqual(midTheta);
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
