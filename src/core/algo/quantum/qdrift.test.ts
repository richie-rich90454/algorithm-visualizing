/**
 * qdrift.test.ts - Independent product reconstruction and convergence checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./qdrift";
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
        const total = frame.entities.reduce((sum, e) => sum + Number(e.value), 0);
        expect(total).toBeCloseTo(1, 8);
    }
}

interface C {
    re: number;
    im: number;
}

const cmul = (a: C, b: C): C => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cadd = (a: C, b: C): C => ({ re: a.re + b.re, im: a.im + b.im });
const cz = (re = 0, im = 0): C => ({ re, im });

function matrixApply(s0: C, s1: C, term: number, angle: number, sign: number): [C, C] {
    const cs = Math.cos(angle);
    const sn = Math.sin(angle) * sign;
    let u00: C;
    let u01: C;
    let u10: C;
    let u11: C;
    if (term === 0) {
        u00 = cz(cs);
        u01 = cz(0, -sn);
        u10 = cz(0, -sn);
        u11 = cz(cs);
    } else {
        u00 = cz(cs, -sn);
        u01 = cz();
        u10 = cz();
        u11 = cz(cs, sn);
    }
    return [cadd(cmul(u00, s0), cmul(u01, s1)), cadd(cmul(u10, s0), cmul(u11, s1))];
}

function sample(seedInput: number, steps: number, pX: number): number[] {
    let seed = seedInput >>> 0;
    const out: number[] = [];
    for (let i = 0; i < steps; i += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        out.push(seed / 4294967296 < pX ? 0 : 1);
    }
    return out;
}

function exactP0(a: number, b: number, phi: number, t: number): number {
    const theta = Math.hypot(a, b);
    const psi0 = Math.cos(phi);
    const psi1 = Math.sin(phi);
    const cs = Math.cos(theta * t);
    const sn = theta > 0 ? Math.sin(theta * t) / theta : 0;
    const re0 = cs * psi0;
    const im0 = -sn * (b * psi0 + a * psi1);
    return re0 * re0 + im0 * im0;
}

function expectedP0(a: number, b: number, phi: number, t: number, steps: number): number {
    const lambda = Math.abs(a) + Math.abs(b);
    const pX = Math.abs(a) / lambda;
    const signs = [a >= 0 ? 1 : -1, b >= 0 ? 1 : -1];
    const angle = (lambda * t) / steps;
    let total = 0;
    for (let mask = 0; mask < 2 ** steps; mask += 1) {
        let s0: C = cz(Math.cos(phi));
        let s1: C = cz(Math.sin(phi));
        let weight = 1;
        for (let j = 0; j < steps; j += 1) {
            const term = (mask >> j) & 1;
            weight *= term === 0 ? pX : 1 - pX;
            [s0, s1] = matrixApply(s0, s1, term, angle, signs[term] ?? 1);
        }
        total += weight * (s0.re * s0.re + s0.im * s0.im);
    }
    return total;
}

describe("QDrift Randomized Product Formula", () => {
    it("reproduces the sampled product with an independent matrix simulator", () => {
        const input = mod.defaultInput as { a: number; b: number; phi: number; t: number; steps: number; seed: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["sampled"]).toEqual(sample(input.seed, input.steps, Math.abs(input.a) / (Math.abs(input.a) + Math.abs(input.b))));

        const terms = final?.["sampled"] as number[];
        const lambda = Math.abs(input.a) + Math.abs(input.b);
        const signs = [input.a >= 0 ? 1 : -1, input.b >= 0 ? 1 : -1];
        let s0: C = cz(Math.cos(input.phi));
        let s1: C = cz(Math.sin(input.phi));
        for (const term of terms) {
            [s0, s1] = matrixApply(s0, s1, term, (lambda * input.t) / input.steps, signs[term] ?? 1);
        }
        expect(final?.["p0"]).toBeCloseTo(s0.re * s0.re + s0.im * s0.im, 9);
        expect(final?.["p1"]).toBeCloseTo(s1.re * s1.re + s1.im * s1.im, 9);
        expect(final?.["norm"]).toBeCloseTo(1, 9);
    });

    it("converges in expectation as the slice count grows", () => {
        const a = 1;
        const b = 0.5;
        const phi = 0.3;
        const t = 1.5;
        const exact = exactP0(a, b, phi, t);
        const error2 = Math.abs(expectedP0(a, b, phi, t, 2) - exact);
        const error8 = Math.abs(expectedP0(a, b, phi, t, 8) - exact);
        expect(error8).toBeLessThan(error2);
        expect(error8).toBeLessThan(0.05);
    });

    it("is reproducible for a fixed seed", () => {
        const first = [...mod.run({ a: 1, b: 0.5, steps: 6, seed: 999 })];
        const second = [...mod.run({ a: 1, b: 0.5, steps: 6, seed: 999 })];
        checkFrames(first);
        expect(first[first.length - 1]?.meta["sampled"]).toEqual(second[second.length - 1]?.meta["sampled"]);
        expect(first[first.length - 1]?.meta["p0"]).toBe(second[second.length - 1]?.meta["p0"]);
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
