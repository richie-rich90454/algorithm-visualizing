/**
 * attribute-based-encryption.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./attribute-based-encryption";
import type { VisualFrame } from "@/types";

const PRIME = 1000003;

function powMod(base: number, exponent: number, mod: number): number {
    let result = 1;
    let b = ((base % mod) + mod) % mod;
    let e = exponent;
    while (e > 0) {
        if (e & 1) {
            result = (result * b) % mod;
        }
        b = (b * b) % mod;
        e = Math.floor(e / 2);
    }
    return result;
}

function keyByte(secret: number): number {
    let h = Math.imul(secret >>> 0, 2654435761) >>> 0;
    h ^= h >>> 15;
    return h & 0xff;
}

function evalPoly(coeffs: number[], x: number): number {
    let result = 0;
    for (let i = coeffs.length - 1; i >= 0; i -= 1) {
        result = (result * x + (coeffs[i] ?? 0)) % PRIME;
    }
    return (result + PRIME) % PRIME;
}

function reconstruct(shares: Map<number, number>, subset: number[]): number {
    let result = 0;
    for (const i of subset) {
        let basis = 1;
        for (const j of subset) {
            if (j === i) {
                continue;
            }
            basis = (basis * (((-j % PRIME) + PRIME) % PRIME)) % PRIME;
            basis = (basis * powMod(i - j, PRIME - 2, PRIME)) % PRIME;
        }
        result = (result + (shares.get(i) ?? 0) * basis) % PRIME;
    }
    return (result + PRIME) % PRIME;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Attribute-Based Encryption (Toy Threshold)", () => {
    it("shares match the polynomial and satisfying subsets decrypt", () => {
        const input = mod.defaultInput as {
            totalAttributes: number;
            threshold: number;
            secret: number;
            plaintext: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta ?? {};
        const coeffs = final["coefficients"] as number[];
        const shareList = final["shares"] as number[];
        const shares = new Map<number, number>();
        shareList.forEach((value, index) => {
            shares.set(index + 1, value);
            expect(value).toBe(evalPoly(coeffs, index + 1));
        });

        const cipher = input.plaintext ^ keyByte(input.secret);
        expect(final["cipher"]).toBe(cipher);
        for (let mask = 1; mask < 1 << input.totalAttributes; mask += 1) {
            const subset: number[] = [];
            for (let i = 1; i <= input.totalAttributes; i += 1) {
                if (mask & (1 << (i - 1))) {
                    subset.push(i);
                }
            }
            const recovered = reconstruct(shares, subset);
            const works = recovered === input.secret && (cipher ^ keyByte(recovered)) === input.plaintext;
            const record = `${subset.join(",")}:${works ? "ok" : "fail"}`;
            const expectation = subset.length >= input.threshold ? "ok" : "fail";
            expect(record).toBe(`${subset.join(",")}:${expectation}`);
            expect(final["subsetResults"]).toContain(record);
        }
    });

    it("obeys the threshold for several policies", () => {
        const cases = [
            { totalAttributes: 3, threshold: 2, secret: 17, plaintext: 42 },
            { totalAttributes: 4, threshold: 3, secret: 98765, plaintext: 200 },
            { totalAttributes: 4, threshold: 2, secret: 5, plaintext: 0 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            const final = frames[frames.length - 1]?.meta ?? {};
            const results = final["subsetResults"] as string[];
            for (const entry of results) {
                const [subsetText, verdict] = entry.split(":");
                const size = (subsetText ?? "").split(",").length;
                expect(verdict).toBe(size >= input.threshold ? "ok" : "fail");
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
