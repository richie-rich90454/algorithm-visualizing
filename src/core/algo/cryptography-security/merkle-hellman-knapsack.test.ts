/**
 * merkle-hellman-knapsack.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./merkle-hellman-knapsack";
import type { VisualFrame } from "@/types";

function inverse(a: number, m: number): number {
    let oldR = ((a % m) + m) % m;
    let r = m;
    let oldS = 1;
    let s = 0;
    while (r !== 0) {
        const q = Math.floor(oldR / r);
        const nr = oldR - q * r;
        oldR = r;
        r = nr;
        const ns = oldS - q * s;
        oldS = s;
        s = ns;
    }
    return ((oldS % m) + m) % m;
}

/** Independent decrypt of a public subset sum back to message bits. */
function decrypt(ciphertext: number, weights: number[], modulus: number, multiplier: number): number[] {
    let rest = (ciphertext * inverse(multiplier, modulus)) % modulus;
    const bits = new Array<number>(weights.length).fill(0);
    for (let i = weights.length - 1; i >= 0; i -= 1) {
        const weight = weights[i] ?? 0;
        if (rest >= weight) {
            rest -= weight;
            bits[i] = 1;
        }
    }
    return bits;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(2 * n + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(3 * n);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(3);
    });
}

describe("Merkle-Hellman Knapsack", () => {
    it("matches the module ciphertext and recovers the default message", () => {
        const input = mod.defaultInput as {
            bits: number[];
            weights: number[];
            modulus: number;
            multiplier: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.weights.length);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["recovered"]).toBe(input.bits.join(""));
        const publicKeys = input.weights.map((w) => (input.multiplier * w) % input.modulus);
        const expected = input.bits.reduce((sum, bit, i) => sum + (bit === 1 ? (publicKeys[i] ?? 0) : 0), 0);
        expect(Number(final?.["ciphertext"])).toBe(expected);
    });

    it("round-trips every possible message bit pattern", () => {
        const input = mod.defaultInput as {
            weights: number[];
            modulus: number;
            multiplier: number;
        };
        const weights = input.weights;
        const publicKeys = weights.map((w) => (input.multiplier * w) % input.modulus);
        for (let mask = 0; mask < 2 ** weights.length; mask += 1) {
            const bits = weights.map((_, i) => ((mask >> i) & 1) as number);
            const ciphertext = bits.reduce((sum, bit, i) => sum + (bit === 1 ? (publicKeys[i] ?? 0) : 0), 0);
            expect(decrypt(ciphertext, weights, input.modulus, input.multiplier)).toEqual(bits);
        }
    });

    it("the private knapsack is superincreasing and the modulus dominates it", () => {
        const input = mod.defaultInput as { weights: number[]; modulus: number; multiplier: number };
        let prefix = 0;
        for (const weight of input.weights) {
            expect(weight).toBeGreaterThan(prefix);
            prefix += weight;
        }
        expect(input.modulus).toBeGreaterThan(prefix);
        expect(inverse(input.multiplier, input.modulus)).toBeGreaterThan(0);
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
