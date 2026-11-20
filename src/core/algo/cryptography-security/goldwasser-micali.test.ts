/**
 * goldwasser-micali.test.ts - Exhaustive residuosity check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./goldwasser-micali";
import type { VisualFrame } from "@/types";

function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let factor = ((base % modulus) + modulus) % modulus;
    let power = exponent;
    while (power > 0) {
        if (power % 2 === 1) {
            result = (result * factor) % modulus;
        }
        factor = (factor * factor) % modulus;
        power = Math.floor(power / 2);
    }
    return result;
}

function legendre(value: number, prime: number): number {
    const result = modPow(((value % prime) + prime) % prime, (prime - 1) / 2, prime);
    return result === 1 ? 1 : result === prime - 1 ? -1 : 0;
}

function gcd(a: number, b: number): number {
    let x = a;
    let y = b;
    while (y !== 0) {
        const next = x % y;
        x = y;
        y = next;
    }
    return x;
}

function checkFrames(frames: VisualFrame[], cols: number): void {
    expect(frames.length).toBe(cols + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(cols * 3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(3);
        expect(frame.meta["cols"]).toBe(cols);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("GoldwasserMicali", () => {
    it("decrypts every bit for every valid random r (exhaustive)", () => {
        const pairs: Array<[number, number]> = [
            [11, 23],
            [7, 11],
            [13, 17],
        ];
        for (const [p, q] of pairs) {
            const n = p * q;
            const probe = [...mod.run({ p, q, bits: [0, 1], seed: 1 })];
            checkFrames(probe, 2);
            const meta = probe[probe.length - 1]?.meta;
            const x = Number(meta?.["x"]);
            expect(legendre(x, p)).toBe(-1);
            expect(legendre(x, q)).toBe(-1);
            for (let bit = 0; bit < 2; bit += 1) {
                for (let r = 1; r < n; r += 1) {
                    if (gcd(r, n) !== 1) {
                        continue;
                    }
                    const cipher = ((bit === 1 ? x : 1) * r * r) % n;
                    expect(legendre(cipher, p) === 1 ? 0 : 1).toBe(bit);
                }
            }
        }
    });

    it("matches the emitted ciphertexts and recovered bits on the default input", () => {
        const input = mod.defaultInput as {
            p: number;
            q: number;
            bits: number[];
            seed: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.bits.length);
        const finalMeta = frames[frames.length - 1]?.meta;
        const x = Number(finalMeta?.["x"]);
        const n = Number(finalMeta?.["n"]);
        const bits = finalMeta?.["bits"] as number[];
        const ciphertexts = finalMeta?.["ciphertexts"] as number[];
        const decoded = finalMeta?.["decoded"] as number[];
        const randoms = finalMeta?.["randoms"] as number[];
        for (let i = 0; i < bits.length; i += 1) {
            expect(ciphertexts[i]).toBe(((bits[i] === 1 ? x : 1) * randoms[i]! * randoms[i]!) % n);
            expect(decoded[i]).toBe(bits[i]);
            expect(gcd(randoms[i]!, n)).toBe(1);
        }
        expect(finalMeta?.["correct"]).toBe(true);
    });

    it("round-trips an alternating message with a different seed", () => {
        const bits = [0, 0, 1, 0, 1, 1, 1, 0];
        const frames = [...mod.run({ bits, seed: 101 })];
        checkFrames(frames, bits.length);
        expect(frames[frames.length - 1]?.meta["decoded"]).toEqual(bits);
        expect(frames[frames.length - 1]?.meta["correct"]).toBe(true);
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
