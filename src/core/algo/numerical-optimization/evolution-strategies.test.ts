/**
 * evolution-strategies.test.ts - Seeded reference cross-check, monotone-best
 * property, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./evolution-strategies";
import type { VisualFrame } from "@/types";

interface Input {
    startX: number;
    startY: number;
    sigma: number;
    generations: number;
    window: number;
    seed: number;
}

function mulberry32(seed: number): () => number {
    let t = seed >>> 0;
    return () => {
        t = (t + 0x6d2b79f5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function normal(rand: () => number): number {
    const u1 = Math.max(rand(), 1e-12);
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Independent replay of the seeded (1+1) evolution strategy. */
function reference(p: Input) {
    const rand = mulberry32(p.seed);
    const f = (x: number, y: number): number => x * x + y * y;
    let x = p.startX;
    let y = p.startY;
    let sigma = p.sigma;
    let best = f(x, y);
    const bestTrace = [best];
    const sigmas = [sigma];
    let successes = 0;
    for (let gen = 1; gen <= p.generations; gen += 1) {
        const childX = x + sigma * normal(rand);
        const childY = y + sigma * normal(rand);
        const childValue = f(childX, childY);
        if (childValue < best) {
            x = childX;
            y = childY;
            best = childValue;
            successes += 1;
        }
        if (gen % p.window === 0) {
            sigma = successes / p.window > 0.2 ? sigma / 0.85 : sigma * 0.85;
            successes = 0;
        }
        bestTrace.push(best);
        sigmas.push(sigma);
    }
    return { x, y, best, sigma, bestTrace, sigmas };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Evolution strategy with one-fifth rule", () => {
    it("matches an independent seeded replay exactly", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["x"])).toBeCloseTo(expected.x, 10);
        expect(Number(finalMeta?.["y"])).toBeCloseTo(expected.y, 10);
        expect(Number(finalMeta?.["objective"])).toBeCloseTo(expected.best, 10);
        expect(Number(finalMeta?.["sigma"])).toBeCloseTo(expected.sigma, 10);

        const trace = frames.slice(0, -1).map((frame) => Number(frame.meta["bestObjective"]));
        expect(trace.length).toBe(expected.bestTrace.length);
        trace.forEach((value, index) => {
            expect(value).toBeCloseTo(expected.bestTrace[index] as number, 10);
        });
    });

    it("never increases the best objective and improves on the start", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const trace = frames.map((frame) => Number(frame.meta["bestObjective"]));
        for (let i = 1; i < trace.length; i += 1) {
            expect(trace[i] as number).toBeLessThanOrEqual((trace[i - 1] as number) + 1e-12);
        }
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["improved"]).toBe(true);
        expect(Number(finalMeta?.["objective"])).toBeLessThan(25);
    });

    it("is reproducible across runs with the same seed", () => {
        const input = mod.defaultInput as Input;
        const a = [...mod.run(input)];
        const b = [...mod.run(input)];
        expect(a.length).toBe(b.length);
        const lastA = a[a.length - 1]?.meta;
        const lastB = b[b.length - 1]?.meta;
        expect(lastA?.["x"]).toBe(lastB?.["x"]);
        expect(lastA?.["y"]).toBe(lastB?.["y"]);
        expect(lastA?.["objective"]).toBe(lastB?.["objective"]);
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
