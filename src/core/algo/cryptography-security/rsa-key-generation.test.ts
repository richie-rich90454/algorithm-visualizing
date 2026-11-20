/**
 * rsa-key-generation.test.ts - Brute-force inverse, full round trip, frame shape.
 */

import { describe, expect, it } from "vitest";
import mod from "./rsa-key-generation";
import type { VisualFrame } from "@/types";

interface Input {
    p: number;
    q: number;
    e: number;
    message: number;
}

function powMod(base: number, exponent: number, modulus: number): number {
    let result = 1n;
    let b = BigInt(base) % BigInt(modulus);
    let e = BigInt(exponent);
    const m = BigInt(modulus);
    while (e > 0n) {
        if (e & 1n) {
            result = (result * b) % m;
        }
        b = (b * b) % m;
        e >>= 1n;
    }
    return Number(result);
}

/** Brute-force the modular inverse instead of using Euclid. */
function bruteInverse(e: number, phi: number): number {
    for (let d = 1; d < phi; d += 1) {
        if ((e * d) % phi === 1) {
            return d;
        }
    }
    return -1;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(16);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(8);
        expect(frame.meta["cols"]).toBe(2);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("RSA Key Generation", () => {
    it("matches a brute-force modular inverse", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const n = Number(final?.["n"]);
        const phi = Number(final?.["phi"]);
        const e = Number(final?.["e"]);
        const d = Number(final?.["d"]);
        expect(n).toBe(input.p * input.q);
        expect(phi).toBe((input.p - 1) * (input.q - 1));
        expect(bruteInverse(e, phi)).toBe(d);
        expect((e * d) % phi).toBe(1);
        expect(final?.["valid"]).toBe(true);
    });

    it("round-trips every message modulo n", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const n = Number(final?.["n"]);
        const e = Number(final?.["e"]);
        const d = Number(final?.["d"]);
        for (let m = 0; m < n; m += 1) {
            expect(powMod(powMod(m, e, n), d, n)).toBe(m);
        }
    });

    it("handles alternative primes and terminates cleanly", () => {
        for (const input of [
            { p: 23, q: 47, e: 7, message: 13 },
            { p: 31, q: 17, e: 11, message: 99 },
        ] as Input[]) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const phi = Number(final?.["phi"]);
            const e = Number(final?.["e"]);
            const d = Number(final?.["d"]);
            expect(bruteInverse(e, phi)).toBe(d);
            expect(final?.["valid"]).toBe(true);
        }
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
