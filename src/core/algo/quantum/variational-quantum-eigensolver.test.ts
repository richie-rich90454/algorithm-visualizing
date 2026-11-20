/**
 * variational-quantum-eigensolver.test.ts - Analytic ground-energy cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./variational-quantum-eigensolver";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], samples: number): void {
    expect(frames.length).toBe(samples + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(samples);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 39621) + 5) >>> 0;
        return state / 0x100000000;
    };
}

describe("Variational Quantum Eigensolver", () => {
    it("finds a grid optimum matching the exact ground energy", () => {
        const random = makeRandom(67);
        const samples = 120;
        for (let trial = 0; trial < 100; trial += 1) {
            const a = random() * 4 - 2;
            const b = random() * 4 - 2;
            const c = random() * 4 - 2;
            const frames = [...mod.run({ a, b, c, samples })];
            checkFrames(frames, samples);
            const finalMeta = frames[frames.length - 1]!.meta;
            const exact = a - Math.sqrt(b * b + c * c);
            expect(Number(finalMeta["exact"])).toBeCloseTo(exact, 12);
            expect(Number(finalMeta["bestEnergy"])).toBeGreaterThanOrEqual(exact - 1e-9);
            expect(Number(finalMeta["bestEnergy"])).toBeLessThan(exact + 3e-3);

            const bestTheta = Number(finalMeta["bestTheta"]);
            const recomputed = a + c * Math.cos(bestTheta) + b * Math.sin(bestTheta);
            expect(recomputed).toBeCloseTo(Number(finalMeta["bestEnergy"]), 9);
        }
    });

    it("handles the pure Z Hamiltonian with ground energy minus one", () => {
        const frames = [...mod.run({ a: 0, b: 0, c: 1, samples: 64 })];
        const finalMeta = frames[frames.length - 1]!.meta;
        expect(Number(finalMeta["exact"])).toBeCloseTo(-1, 12);
        expect(Number(finalMeta["bestEnergy"])).toBeCloseTo(-1, 3);
        expect(Number(finalMeta["bestTheta"])).toBeCloseTo(Math.PI, 1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
