/**
 * pie-aqm.test.ts - Independent PI-controller reference, sign properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./pie-aqm";
import type { VisualFrame } from "@/types";

interface Sample { delay: number; coin?: number }
interface Params { alpha: number; beta: number; target: number; idleDecay: number }

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(entity.type).toBe("bar");
            const p = entity.value as number;
            expect(Number.isFinite(p)).toBe(true);
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThanOrEqual(1);
        }
    });
}

/** Independent recomputation of the PIE PI controller. */
function reference(samples: Sample[], p: Params): number[] {
    let prob = 0;
    let last = p.target;
    const out: number[] = [];
    samples.forEach((s) => {
        const d = Math.max(0, Number(s.delay));
        prob += p.alpha * (d - p.target) + p.beta * (d - last);
        if (d === 0) prob *= 1 - p.idleDecay;
        prob = Math.min(1, Math.max(0, prob));
        last = d;
        out.push(prob);
    });
    return out;
}

describe("PieAqm", () => {
    const defaultInput = mod.defaultInput as { samples: Sample[]; alpha: number; beta: number; target: number; idleDecay: number };

    it("matches an independent PI reference on the default input", () => {
        const frames = [...mod.run(defaultInput)];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        expect(last["probabilities"]).toEqual(reference(defaultInput.samples, defaultInput));
        expect(last["delays"]).toEqual(defaultInput.samples.map((s) => s.delay));
    });

    it("increases probability above target and decreases it below target", () => {
        const params: Params = { alpha: 0.001, beta: 0.001, target: 15, idleDecay: 0.1 };
        const samples = [{ delay: 30 }, { delay: 30 }, { delay: 5 }, { delay: 0 }];
        const frames = [...mod.run({ ...params, samples })];
        checkFrames(frames);
        const probs = frames[frames.length - 1]!.meta["probabilities"] as number[];
        expect(probs).toEqual(reference(samples, params));
        expect(probs[0]).toBeCloseTo(0.03, 9);
        expect(probs[1]).toBeGreaterThan(probs[0]!);
        expect(probs[2]).toBeGreaterThan(0);
        expect(probs[2]).toBeLessThan(probs[1]!);
        expect(probs[3]).toBeLessThan(probs[2]!);
        for (const p of probs) expect(p).toBeGreaterThanOrEqual(0);
    });

    it("keeps probability at zero when delay stays at target", () => {
        const params: Params = { alpha: 0.05, beta: 0.2, target: 10, idleDecay: 0.1 };
        const samples = Array.from({ length: 5 }, () => ({ delay: 10 }));
        const frames = [...mod.run({ ...params, samples })];
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["probabilities"]).toEqual(reference(samples, params));
        expect(frames[frames.length - 1]!.meta["finalProbability"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
