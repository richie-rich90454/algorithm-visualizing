/**
 * plonk-snark.test.ts - Independent domain, vanishing polynomial, convolution,
 * and identity checks; corruption rejection; frame shape; termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./plonk-snark";
import type { VisualFrame } from "@/types";

const P = 97;

function modp(v: number): number {
    return ((v % P) + P) % P;
}

function pow(base: number, exp: number): number {
    let r = 1;
    let b = modp(base);
    let e = exp;
    while (e > 0) {
        if (e & 1) r = modp(r * b);
        b = modp(b * b);
        e = Math.floor(e / 2);
    }
    return r;
}

function findOmega(): number {
    for (let a = 2; a < P; a += 1) {
        if (pow(a, 4) === 1 && pow(a, 2) !== 1) return a;
    }
    return 1;
}

function evaluate(coeffs: number[], x: number): number {
    let result = 0;
    let power = 1;
    for (const c of coeffs) {
        result = modp(result + c * power);
        power = modp(power * x);
    }
    return result;
}

function multiply(a: number[], b: number[]): number[] {
    const out = new Array<number>(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) {
            out[i + j] = modp((out[i + j] ?? 0) + (a[i] ?? 0) * (b[j] ?? 0));
        }
    }
    return out;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["p"]).toBe(P);
    });
}

describe("ToyPLONKIdentity", () => {
    it("matches an independent vanishing-polynomial and convolution reference", () => {
        const input = mod.defaultInput as { h: number[]; zeta: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const w = findOmega();
        const domain = [1, w, pow(w, 2), pow(w, 3)];
        const z = [modp(-1), 0, 0, 0, 1];
        const f = multiply(input.h, z);
        expect(final?.["omega"]).toBe(w);
        expect(final?.["domain"]).toEqual(domain);
        expect(final?.["zCoeffs"]).toEqual(z);
        expect(final?.["fCoeffs"]).toEqual(f);
        for (const x of domain) expect(evaluate(z, x)).toBe(0);
        const evals = final?.["domainEvals"] as number[];
        expect(evals.every((v) => v === 0)).toBe(true);
        expect(final?.["vanishes"]).toBe(true);
        expect(final?.["left"]).toBe(evaluate(f, input.zeta));
        expect(final?.["right"]).toBe(modp(evaluate(input.h, input.zeta) * evaluate(z, input.zeta)));
        expect(final?.["accept"]).toBe(true);
    });

    it("rejects a corrupted constraint polynomial", () => {
        const frames = [...mod.run({ h: [2, 3, 1], zeta: 11, corrupt: true })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["accept"]).toBe(false);
        expect(final?.["vanishes"]).toBe(false);
        expect(final?.["pointMatches"]).toBe(false);
    });

    it("accepts valid identities for varied quotients and points", () => {
        for (const h of [[1], [4, 5], [2, 0, 7, 1]]) {
            for (const zeta of [3, 11, 50]) {
                const final = [...mod.run({ h, zeta })].pop()?.meta;
                expect(final?.["accept"]).toBe(true);
                expect(final?.["left"]).toBe(final?.["right"]);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
