import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./related-message-attack";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber).toBeLessThan(module.pseudocode!.length);
        expect(f.layout).toBe(module.visualType);
        expect(f.meta).toBeDefined();
    });
}

function powMod(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = 1n;
    let b = base % mod;
    let e = exp;
    while (e > 0n) {
        if (e % 2n === 1n) result = (result * b) % mod;
        b = (b * b) % mod;
        e /= 2n;
    }
    return result;
}

describe("Related-Message Attack", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("recovers several related messages over a prime modulus", () => {
        const n = 1000003n;
        for (const message of [1234, 5, 9999, 42]) {
            const frames = [...module.run({ n: Number(n), e: 3, a: 2, b: 3, message })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!;
            expect(last.meta.recovered).toBe(String(message));
            expect(powMod(BigInt(message), 3n, n)).toBe(BigInt(last.meta.c1 as string));
        }
    });
});
