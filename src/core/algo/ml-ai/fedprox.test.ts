/** fedprox.test.ts - Reference cross-check, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod, { fedProxClientStep, fedProxRound } from "./fedprox";
import type { VisualFrame } from "@/types";

/** Explicit brute-force FedProx round built without the exported helpers. */
function referenceRound(
    global: number[],
    targets: number[][],
    lr: number,
    mu: number,
    localSteps: number,
): number[] {
    const finals = targets.map((target) => {
        const w = [...global];
        for (let s = 0; s < localSteps; s += 1) {
            for (let d = 0; d < w.length; d += 1) {
                const grad = w[d]! - (target[d] ?? 0) + mu * (w[d]! - (global[d] ?? 0));
                w[d] = w[d]! - lr * grad;
            }
        }
        return w;
    });
    return global.map((_g, d) => finals.reduce((sum, w) => sum + w[d]!, 0) / finals.length);
}

function checkFrames(frames: VisualFrame[], expectedBars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(expectedBars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("FedProx", () => {
    it("matches an explicit per-client simulation", () => {
        const global = [0.2, -0.3, 0.5];
        const targets = [
            [1, 1, 1],
            [-1, -0.5, 2],
            [0, 2, -1],
        ];
        const got = fedProxRound(global, targets, 0.1, 0.3, 3);
        const expected = referenceRound(global, targets, 0.1, 0.3, 3);
        got.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 10));
    });

    it("reduces drift as mu grows and reverts to FedAvg at mu = 0", () => {
        const global = [0, 0];
        const target = [1, 1];
        const drift = (mu: number) => {
            let w = [...global];
            for (let s = 0; s < 4; s += 1) {
                w = fedProxClientStep(w, target, global, 0.5, mu);
            }
            return Math.hypot(w[0]!, w[1]!);
        };
        expect(drift(2)).toBeLessThan(drift(1));
        expect(drift(1)).toBeLessThan(drift(0));
        expect(drift(0)).toBeGreaterThan(1);
    });

    it("produces well-formed frames and terminates", () => {
        const input = mod.defaultInput as { globalWeights: number[] };
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, input.globalWeights.length);
        const final = frames[frames.length - 1]!;
        expect(final.meta["converged"]).toBe(true);
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe(frames.length);
        expect(gen.next().done).toBe(true);
    });
});
