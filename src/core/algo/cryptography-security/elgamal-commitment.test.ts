/**
 * elgamal-commitment.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./elgamal-commitment";
import type { VisualFrame } from "@/types";

interface Input {
    p: number;
    g: number;
    x: number;
    message: number;
    randomness: number;
    forgery: { message: number; randomness: number };
}

/** Independent modular power using iterative multiplication (no shared helper). */
function power(base: number, exp: number, mod: number): number {
    let result = 1;
    for (let i = 0; i < exp; i += 1) result = (result * base) % mod;
    return result;
}

function commitment(message: number, randomness: number, g: number, h: number, p: number): number {
    return (power(g, message, p) * power(h, randomness, p)) % p;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("ElGamal Commitment", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent commitment computation", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 2]?.meta;
        const h = power(input.g, input.x, input.p);
        const expected = commitment(input.message, input.randomness, input.g, h, input.p);
        expect(final?.["h"]).toBe(h);
        expect(final?.["commitment"]).toBe(expected);
        expect(final?.["openingValid"]).toBe(1);
    });

    it("rejects a forged opening and accepts the real one across many inputs", () => {
        let seed = 909;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        const primes = [101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199];
        for (let trial = 0; trial < 30; trial += 1) {
            const p = primes[rand() % primes.length]!;
            const g = 2 + (rand() % 50);
            const x = 1 + (rand() % 30);
            const message = rand() % 60;
            const randomness = rand() % 60;
            const testInput: Input = {
                p, g, x, message, randomness,
                forgery: { message: message + 1, randomness },
            };
            const frames = [...mod.run(testInput)];
            checkFrames(frames);
            const real = frames[frames.length - 2]?.meta;
            const forged = frames[frames.length - 1]?.meta;
            const h = power(g, x, p);
            expect(real?.["commitment"]).toBe(commitment(message, randomness, g, h, p));
            expect(real?.["openingValid"]).toBe(1);
            expect(forged?.["forgedValid"]).toBe(0);
        }
    });

    it("is hiding: a different nonce changes the published commitment", () => {
        const a = [...mod.run({ ...input, randomness: 5 })];
        const b = [...mod.run({ ...input, randomness: 6 })];
        const ca = a[a.length - 2]?.meta["commitment"];
        const cb = b[b.length - 2]?.meta["commitment"];
        expect(ca).not.toBe(cb);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
