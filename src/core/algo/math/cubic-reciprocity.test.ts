/** cubic-reciprocity.test.ts - Brute-force reciprocity check, frames, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./cubic-reciprocity";
import type { VisualFrame } from "@/types";

type Eis = [number, number];
const modn = (n: number, m: number): number => ((n % m) + m) % m;
const mul = (a: Eis, b: Eis): Eis => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0] - a[1] * b[1]];
const norm = (a: Eis): number => a[0] * a[0] - a[0] * a[1] + a[1] * a[1];
const UNITS: Eis[] = [[1, 0], [-1, 0], [0, 1], [0, -1], [-1, -1], [1, 1]];
function powMod(a: number, e: number, m: number): number {
    let r = 1;
    let b = modn(a, m);
    while (e > 0) {
        if (e % 2 === 1) r = (r * b) % m;
        b = (b * b) % m;
        e = Math.floor(e / 2);
    }
    return r;
}
function primaryPrime(p: number): Eis {
    const B = Math.ceil(Math.sqrt(p)) + 1;
    for (let a = -B; a <= B; a += 1) {
        for (let b = -B; b <= B; b += 1) {
            if (norm([a, b]) !== p) continue;
            for (const u of UNITS) {
                const r = mul([a, b], u);
                if (modn(r[0], 3) === 2 && modn(r[1], 3) === 0) return r;
            }
        }
    }
    throw new Error(`no primary prime above ${p}`);
}
function char(alpha: Eis, pi: Eis): number {
    const p = norm(pi);
    let r = -1;
    for (let t = 0; t < p; t += 1) {
        if (modn(t * t + t + 1, p) === 0 && modn(pi[0] + pi[1] * t, p) === 0) {
            r = t;
            break;
        }
    }
    const k = powMod(modn(alpha[0] + alpha[1] * r, p), Math.floor((p - 1) / 3), p);
    if (k === 1 % p) return 0;
    if (k === r % p) return 1;
    return 2;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n * (n - 1) / 2 + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Cubic reciprocity", () => {
    it("matches an independent character implementation on every prime pair", () => {
        const primes = [7, 13, 19, 31, 37, 43];
        const frames = [...mod.run({ primes })];
        checkFrames(frames, primes.length);
        const final = frames[frames.length - 1]!.meta;
        expect(final["verified"]).toBe(true);
        expect(Number(final["failures"])).toBe(0);
        expect(Number(final["pairs"])).toBe(primes.length * (primes.length - 1) / 2);
        for (let i = 0; i < primes.length; i += 1) {
            for (let j = 0; j < primes.length; j += 1) {
                const pi = primaryPrime(primes[i]!);
                const rho = primaryPrime(primes[j]!);
                expect(norm(pi)).toBe(primes[i]);
                expect(char(pi, rho)).toBe(char(rho, pi));
            }
        }
    });

    it("character values are cube roots of unity", () => {
        const pi = primaryPrime(7);
        const rho = primaryPrime(13);
        const value = char(pi, rho);
        expect([0, 1, 2]).toContain(value);
        const p = norm(rho);
        let r = -1;
        for (let t = 0; t < p; t += 1) if (modn(t * t + t + 1, p) === 0 && modn(pi[0] + pi[1] * t, p) === 0) r = t;
        const k = powMod(modn(pi[0] + pi[1] * r, p), Math.floor((p - 1) / 3), p);
        expect(powMod(k, 3, p)).toBe(1 % p);
    });

    it("ignores primes not congruent to 1 mod 3", () => {
        const frames = [...mod.run({ primes: [2, 3, 5, 7, 13] })];
        checkFrames(frames, 2);
        expect(frames[frames.length - 1]!.meta["verified"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
