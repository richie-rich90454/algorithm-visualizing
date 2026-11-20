/** elgamal-encryption.test.ts - Equation checks, round trips, frames. */

import { describe, expect, it } from "vitest";
import mod, { buildElGamal, modInverse, modPow } from "./elgamal-encryption";
import type { VisualFrame } from "@/types";

interface Input {
    p: number;
    g: number;
    x: number;
    message: number;
    seed: number;
}

function powRef(base: number, exp: number, mod: number): number {
    let result = 1;
    let b = base % mod;
    let e = exp;
    while (e > 0) {
        if (e % 2 === 1) result = (result * b) % mod;
        b = (b * b) % mod;
        e = Math.floor(e / 2);
    }
    return result;
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 2);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("ElGamal Encryption", () => {
    it("satisfies the public-key and ciphertext equations", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, 11);
        const final = frames[frames.length - 1]?.meta;
        const data = buildElGamal(input.p, input.g, input.x, input.message, input.seed);
        expect(data.y).toBe(powRef(input.g, input.x, input.p));
        expect(data.c1).toBe(powRef(input.g, data.k, input.p));
        expect(data.shared).toBe(powRef(data.y, data.k, input.p));
        expect(data.recoveredShared).toBe(data.shared);
        expect(data.c2).toBe((input.message * data.shared) % input.p);
        expect(final?.["y"]).toBe(data.y);
        expect(final?.["decrypted"]).toBe(input.message);
    });

    it("round-trips many messages and seeds", () => {
        for (const p of [467, 101, 997]) {
            for (const seed of [1, 7, 20261118, 999983]) {
                for (const message of [1, 2, 42, p - 1]) {
                    const frames = [...mod.run({ p, g: 2, x: 31, message, seed })];
                    const final = frames[frames.length - 1]?.meta;
                    expect(final?.["decrypted"]).toBe(message);
                    expect(final?.["agreed"]).toBe(true);
                }
            }
        }
    });

    it("modular inverse and modpow agree with reference calculations", () => {
        expect(modPow(2, 127, 467)).toBe(powRef(2, 127, 467));
        for (const p of [467, 101, 997]) {
            for (let a = 1; a < p; a += 1) {
                expect((a * modInverse(a, p)) % p).toBe(1);
            }
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
