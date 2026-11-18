/**
 * backpropagation.test.ts - Finite-difference gradient check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./backpropagation";
import type { VisualFrame } from "@/types";

const KEYS = ["x0h0", "x1h0", "x0h1", "x1h1", "h0o", "h1o", "bh0", "bh1", "bo"] as const;
type WKey = (typeof KEYS)[number];
type Weights = Record<WKey, number>;

const X = [0.5, 0.8];
const TARGET = 0.7;
const DEFAULT_W: Weights = {
    x0h0: 0.1,
    x1h0: -0.2,
    x0h1: 0.3,
    x1h1: 0.4,
    h0o: 0.5,
    h1o: -0.6,
    bh0: 0.1,
    bh1: -0.1,
    bo: 0.2,
};

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

/** Independent loss evaluator used only by the finite-difference oracle. */
function lossAt(w: Weights): number {
    const h0 = sigmoid(X[0]! * w.x0h0 + X[1]! * w.x1h0 + w.bh0);
    const h1 = sigmoid(X[0]! * w.x0h1 + X[1]! * w.x1h1 + w.bh1);
    const o = sigmoid(h0 * w.h0o + h1 * w.h1o + w.bo);
    return 0.5 * (o - TARGET) ** 2;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(5);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(6);
        expect(frame.edges.every((e) => e.sourceId.startsWith("node-") && e.targetId.startsWith("node-"))).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Backpropagation", () => {
    it("matches central finite differences for every weight and bias", () => {
        const frames = [...mod.run({ x: X, target: TARGET })];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta ?? {};
        const eps = 1e-5;
        for (const key of KEYS) {
            const analytic = Number(finalMeta[`grad_${key}`]);
            const up = { ...DEFAULT_W, [key]: DEFAULT_W[key] + eps };
            const down = { ...DEFAULT_W, [key]: DEFAULT_W[key] - eps };
            const numeric = (lossAt(up) - lossAt(down)) / (2 * eps);
            expect(Number.isFinite(analytic)).toBe(true);
            expect(analytic).toBeCloseTo(numeric, 4);
        }
    });

    it("reports a loss matching an independent forward pass", () => {
        const frames = [...mod.run({ x: X, target: TARGET })];
        const finalMeta = frames[frames.length - 1]?.meta ?? {};
        expect(Number(finalMeta["loss"])).toBeCloseTo(lossAt(DEFAULT_W), 9);
    });

    it("gradients change when the target changes", () => {
        const a = [...mod.run({ x: X, target: 0.1 })];
        const b = [...mod.run({ x: X, target: 0.9 })];
        const ga = Number(a[a.length - 1]?.meta["grad_h0o"]);
        const gb = Number(b[b.length - 1]?.meta["grad_h0o"]);
        expect(ga).not.toBeCloseTo(gb, 4);
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
