/**
 * hamiltonian-monte-carlo.test.ts - Independent reference, statistical property,
 * frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./hamiltonian-monte-carlo";
import type { VisualFrame } from "@/types";

function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function normal(rng: () => number): number {
    return Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12))) * Math.cos(2 * Math.PI * rng());
}

function H(q: number, p: number): number {
    return (q * q) / 2 + (p * p) / 2;
}

/** Independent reference: replay the same deterministic chain. */
function reference(steps: number, eps: number, leap: number, seed: number) {
    const rng = makeRng(seed);
    let q = 0;
    let accepted = 0;
    let sum = 0;
    for (let iteration = 0; iteration < steps; iteration += 1) {
        const p0 = normal(rng);
        let position = q;
        let momentum = p0 - (eps / 2) * position;
        for (let i = 0; i < leap; i += 1) {
            position += eps * momentum;
            momentum -= eps * position;
        }
        momentum -= (eps / 2) * position;
        momentum = -momentum;
        const delta = H(position, momentum) - H(q, p0);
        if (rng() < Math.min(1, Math.exp(-delta))) {
            q = position;
            accepted += 1;
            sum += q;
        }
    }
    return { current: q, accepted, mean: sum / (accepted || 1) };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const e of frame.entities) {
            expect(Number.isFinite(e.x)).toBe(true);
            expect(Number.isFinite(e.y)).toBe(true);
        }
    });
}

describe("Hamiltonian Monte Carlo", () => {
    it("matches an independent deterministic reference", () => {
        const input = mod.defaultInput as {
            steps: number;
            stepSize: number;
            leapfrogSteps: number;
            seed: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.steps, input.stepSize, input.leapfrogSteps, input.seed);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["current"]).toBeCloseTo(expected.current, 10);
        expect(last?.["accepted"]).toBe(expected.accepted);
        expect(last?.["mean"]).toBeCloseTo(expected.mean, 10);
    });

    it("centers its samples near zero for a standard normal target", () => {
        const frames = [...mod.run({ steps: 400, stepSize: 0.25, leapfrogSteps: 8, seed: 11 })];
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["accepted"])).toBeGreaterThan(200);
        expect(Math.abs(Number(last?.["mean"]))).toBeLessThan(0.4);
    });

    it("reports monotone acceptance counts and terminates cleanly", () => {
        const generator = mod.run({ steps: 30, seed: 3 });
        const frames = [...generator];
        checkFrames(frames);
        let previous = 0;
        for (const frame of frames.slice(1, -1)) {
            const count = Number(frame.meta["acceptedCount"]);
            expect(count).toBeGreaterThanOrEqual(previous);
            previous = count;
        }
        expect(generator.next().done).toBe(true);
    });
});
