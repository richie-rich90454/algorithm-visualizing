/**
 * hamiltonian-simulation.test.ts - Independent matrix-exponential comparison.
 */

import { describe, expect, it } from "vitest";
import mod from "./hamiltonian-simulation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (!frame) {
            continue;
        }
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.length).toBe(2);
        expect(frame.meta["norm"] as number).toBeCloseTo(1, 9);
    }
}

interface C {
    re: number;
    im: number;
}

const add = (a: C, b: C): C => ({ re: a.re + b.re, im: a.im + b.im });
const mul = (a: C, b: C): C => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const scale = (a: C, s: number): C => ({ re: a.re * s, im: a.im * s });

/** Independent exp(-i H t) by truncated power series on complex 2-vectors. */
function referenceState(bx: number, bz: number, phi: number, t: number): [C, C] {
    let v0: C = { re: Math.cos(phi), im: 0 };
    let v1: C = { re: Math.sin(phi), im: 0 };
    let term0: C = { re: v0.re, im: v0.im };
    let term1: C = { re: v1.re, im: v1.im };
    const negI: C = { re: 0, im: -1 };
    for (let k = 1; k <= 40; k += 1) {
        const next0 = add(scale(mul(negI, { re: bz * term0.re + bx * term1.re, im: bz * term0.im + bx * term1.im }), t), scale({ re: 0, im: 0 }, 0));
        const next1 = add(scale(mul(negI, { re: bx * term0.re - bz * term1.re, im: bx * term0.im - bz * term1.im }), t), scale({ re: 0, im: 0 }, 0));
        term0 = scale(next0, 1 / k);
        term1 = scale(next1, 1 / k);
        v0 = add(v0, term0);
        v1 = add(v1, term1);
    }
    return [v0, v1];
}

describe("Hamiltonian Simulation", () => {
    it("matches an independent power series on the default input", () => {
        const input = mod.defaultInput as { bx: number; bz: number; phi: number; t: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const amps = final?.["amps"] as number[];
        const [r0, r1] = referenceState(input.bx, input.bz, input.phi, input.t);
        expect(amps[0]).toBeCloseTo(r0.re, 8);
        expect(amps[1]).toBeCloseTo(r0.im, 8);
        expect(amps[2]).toBeCloseTo(r1.re, 8);
        expect(amps[3]).toBeCloseTo(r1.im, 8);
    });

    it("keeps Z evolution probability-preserving and flips X as expected", () => {
        const zFrames = [...mod.run({ bx: 0, bz: 1, phi: 0.4, t: 3, steps: 4 })];
        checkFrames(zFrames);
        const zFinal = zFrames[zFrames.length - 1]?.meta;
        expect(Number(zFinal?.["p0"])).toBeCloseTo(Math.cos(0.4) ** 2, 9);

        const xFrames = [...mod.run({ bx: 1, bz: 0, phi: 0, t: Math.PI / 2, steps: 2 })];
        checkFrames(xFrames);
        const xFinal = xFrames[xFrames.length - 1]?.meta;
        expect(Number(xFinal?.["p1"])).toBeCloseTo(1, 9);
    });

    it("matches the power series on random Hamiltonians", () => {
        let seed = 67;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (let trial = 0; trial < 20; trial += 1) {
            const bx = rand() * 2 - 1;
            const bz = rand() * 2 - 1;
            const phi = rand() * Math.PI;
            const t = rand() * 2;
            const frames = [...mod.run({ bx, bz, phi, t, steps: 4 })];
            checkFrames(frames);
            const amps = frames[frames.length - 1]?.meta["amps"] as number[];
            const [r0, r1] = referenceState(bx, bz, phi, t);
            expect(amps[0]).toBeCloseTo(r0.re, 7);
            expect(amps[1]).toBeCloseTo(r0.im, 7);
            expect(amps[2]).toBeCloseTo(r1.re, 7);
            expect(amps[3]).toBeCloseTo(r1.im, 7);
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
