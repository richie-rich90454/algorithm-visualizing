/**
 * rabin-cryptosystem.test.ts - Brute-force preimage set, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./rabin-cryptosystem";
import type { VisualFrame } from "@/types";

interface Input {
    p: number;
    q: number;
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

describe("Rabin Cryptosystem", () => {
    it("finds exactly the brute-force square-root preimage set", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const n = Number(final?.["n"]);
        const cipher = Number(final?.["cipher"]);
        const roots = final?.["roots"] as number[];
        expect(roots.length).toBe(4);

        // Brute force every message modulo n and collect those squaring to c.
        const expected: number[] = [];
        for (let m = 0; m < n; m += 1) {
            if (powMod(m, 2, n) === cipher) {
                expected.push(m);
            }
        }
        expect(roots.slice().sort((a, b) => a - b)).toEqual(expected.sort((a, b) => a - b));
        for (const root of roots) {
            expect(powMod(root, 2, n)).toBe(cipher);
        }
        expect(roots).toContain(input.message % n);
        expect(final?.["valid"]).toBe(true);
    });

    it("works for several messages and prime pairs", () => {
        const cases: Input[] = [
            { p: 23, q: 47, message: 2 },
            { p: 23, q: 47, message: 541 },
            { p: 11, q: 19, message: 43 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const n = Number(final?.["n"]);
            const cipher = Number(final?.["cipher"]);
            const roots = final?.["roots"] as number[];
            expect(new Set(roots).size).toBe(4);
            for (const root of roots) {
                expect(powMod(root, 2, n)).toBe(cipher);
            }
            expect(roots).toContain(input.message % n);
            expect(final?.["valid"]).toBe(true);
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
