/**
 * bulletproof-range-proof.test.ts - Independent fold check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bulletproof-range-proof";
import type { VisualFrame } from "@/types";

const P = 2147483647n;

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = 1n;
    let b = ((base % mod) + mod) % mod;
    let e = exp;
    while (e > 0n) {
        if (e & 1n) {
            result = (result * b) % mod;
        }
        b = (b * b) % mod;
        e >>= 1n;
    }
    return result;
}

/** Independent reference for the recovered inner product. */
function reference(value: number, bits: number, u: number): bigint {
    const a: bigint[] = [];
    const b: bigint[] = [];
    for (let i = 0; i < bits; i += 1) {
        a.push(BigInt((value >> i) & 1));
        b.push(1n << BigInt(i));
    }
    const uu = BigInt(u);
    const inv = modPow(uu, P - 2n, P);
    let totalCorrection = 0n;
    while (a.length > 1) {
        if (a.length % 2 === 1) {
            a.push(0n);
            b.push(0n);
        }
        const half = a.length / 2;
        const c1 = a.slice(0, half).reduce((s, x, i) => (s + x * (b[half + i] ?? 0n)) % P, 0n);
        const c2 = a.slice(half).reduce((s, x, i) => (s + x * (b[i] ?? 0n)) % P, 0n);
        const corr = (inv * c1 + uu * c2) % P;
        const na: bigint[] = [];
        const nb: bigint[] = [];
        for (let i = 0; i < half; i += 1) {
            na.push(((a[i] ?? 0n) + uu * (a[half + i] ?? 0n)) % P);
            nb.push(((b[i] ?? 0n) + inv * (b[half + i] ?? 0n)) % P);
        }
        a.length = 0;
        a.push(...na);
        b.length = 0;
        b.push(...nb);
        totalCorrection = (totalCorrection + corr) % P;
    }
    const folded = a.reduce((s, x, i) => (s + x * (b[i] ?? 0n)) % P, 0n);
    return ((folded - totalCorrection) % P + P) % P;
}

function checkFrames(frames: VisualFrame[], bits: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(bits * 2);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(2);
        expect(frame.meta["cols"]).toBe(bits);
    });
}

describe("Bulletproof range argument (toy)", () => {
    it("recovers the value on a grid of in-range inputs", () => {
        for (const bits of [2, 3, 4]) {
            for (let value = 0; value < 1 << bits; value += 1) {
                for (const u of [2, 3, 5]) {
                    const input = { value, bits, u };
                    const frames = [...mod.run(input)];
                    checkFrames(frames, bits);
                    const last = frames[frames.length - 1]?.meta;
                    expect(Number(last?.["recovered"])).toBe(Number(reference(value, bits, u)));
                    expect(Number(last?.["recovered"])).toBe(value);
                    expect(last?.["accepted"]).toBe(true);
                    expect(last?.["inRange"]).toBe(true);
                    expect(Number(last?.["rounds"])).toBeGreaterThanOrEqual(1);
                    expect(Number(last?.["rounds"])).toBeLessThanOrEqual(bits);
                }
            }
        }
    });

    it("rejects out-of-range values", () => {
        const frames = [...mod.run({ value: 12, bits: 3, u: 3 })];
        checkFrames(frames, 3);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["inRange"]).toBe(false);
        expect(last?.["accepted"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
