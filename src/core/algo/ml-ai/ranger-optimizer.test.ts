/**
 * ranger-optimizer.test.ts - Independent Ranger step recomputation,
 * optimizer properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { rangerStep } from "./ranger-optimizer";
import type { VisualFrame } from "@/types";

const STATES = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

/** Independent from-scratch recomputation of one Ranger update. */
function reference(params: number[], grads: number[], state: { t: number; m: number[]; v: number[]; slow: number[] }, cfg: Record<string, number>) {
    const d = params.length;
    const t = state.t + 1;
    const mean = grads.reduce((a, b) => a + b, 0) / d;
    const centered = grads.map((g) => g - mean);
    const m = centered.map((g, i) => cfg.beta1 * state.m[i] + (1 - cfg.beta1) * g);
    const v = centered.map((g, i) => cfg.beta2 * state.v[i] + (1 - cfg.beta2) * g * g);
    const mhat = m.map((x) => x / (1 - Math.pow(cfg.beta1, t)));
    const vhat = v.map((x) => x / (1 - Math.pow(cfg.beta2, t)));
    const rhoInf = 2 / (1 - cfg.beta2) - 1;
    const bt = Math.pow(cfg.beta2, t);
    const rho = rhoInf - (2 * t * bt) / (1 - bt);
    let rect = 0;
    if (rhoInf <= 4) rect = 1;
    else if (rho > 4) rect = Math.sqrt(((rho - 4) * (rho - 2) * rhoInf) / ((rhoInf - 4) * (rhoInf - 2) * rho));
    const stepVec = mhat.map((x, i) => (rect * x) / (Math.sqrt(vhat[i]) + cfg.eps));
    const fast = state.slow.map((s, i) => s - cfg.lr * stepVec[i]);
    const applied = t % cfg.lookaheadEvery === 0;
    const slow = state.slow.map((s, i) => (applied ? s + cfg.alpha * (fast[i] - s) : s));
    return { t, centered, m, v, mhat, vhat, rho, rect, stepVec, fast, slow, applied };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) expect(STATES.has(entity.state)).toBe(true);
    });
}

describe("Ranger optimizer", () => {
    it("matches an independent recomputation on random states", () => {
        const cfg = { lr: 0.02, beta1: 0.9, beta2: 0.9, eps: 1e-8, alpha: 0.5, lookaheadEvery: 3 };
        for (let k = 0; k < 15; k += 1) {
            const d = 4;
            const params = Array.from({ length: d }, (_, i) => (i + k) / 5 - 1);
            const grads = Array.from({ length: d }, (_, i) => ((i * 3 + k * 7) % 11) / 10 - 0.5);
            const state = {
                t: 1 + (k % 9),
                m: Array.from({ length: d }, (_, i) => (i - k) / 20),
                v: Array.from({ length: d }, (_, i) => (i + k + 1) / 30),
                slow: params.slice(),
            };
            const got = rangerStep(params, grads, state, cfg);
            const ref = reference(params, grads, state, cfg);
            expect(got.t).toBe(ref.t);
            expect(got.centered).toEqual(ref.centered);
            expect(got.m).toEqual(ref.m);
            expect(got.v).toEqual(ref.v);
            expect(got.mhat).toEqual(ref.mhat);
            expect(got.vhat).toEqual(ref.vhat);
            expect(got.rho).toBeCloseTo(ref.rho, 10);
            expect(got.rect).toBeCloseTo(ref.rect, 10);
            expect(got.stepVec).toEqual(ref.stepVec);
            expect(got.fast).toEqual(ref.fast);
            expect(got.slow).toEqual(ref.slow);
            expect(got.applied).toBe(ref.applied);
        }
    });

    it("satisfies gradient-centering and lookahead properties", () => {
        const grads = [0.5, 0.2, -0.4, 0.1];
        const state = { t: 4, m: [0, 0, 0, 0], v: [0, 0, 0, 0], slow: [1, 1, 1, 1] };
        const out = rangerStep(state.slow, grads, state, { beta2: 0.9, lookaheadEvery: 5 });
        expect(out.centered.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 10);
        expect(out.rect).toBeGreaterThanOrEqual(0);
        expect(out.rect).toBeLessThanOrEqual(1);
        expect(out.applied).toBe(true);

        const zeroLr = rangerStep(state.slow, grads, state, { lr: 0, lookaheadEvery: 5 });
        expect(zeroLr.fast).toEqual(state.slow);
        expect(zeroLr.slow).toEqual(state.slow);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["applied"]).toBe(true);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
