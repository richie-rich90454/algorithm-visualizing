import { describe, expect, it } from "vitest";
import mod from "./lehmer-gcd";
import type { VisualFrame } from "@/types";

function gcdReference(a: bigint, b: bigint): bigint {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y !== 0n) {
        const next = x % y;
        x = y;
        y = next;
    }
    return x;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Lehmer GCD", () => {
    it("matches big-integer Euclid on large random operands", () => {
        let seed = 99887766;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed;
        };
        for (let trial = 0; trial < 30; trial += 1) {
            let a = "";
            let b = "";
            for (let digit = 0; digit < 30; digit += 1) {
                a += String(next() % 10);
                b += String(next() % 10);
            }
            const frames = [...mod.run({ a, b })];
            checkFrames(frames);
            expect(BigInt(String(frames[frames.length - 1]?.meta["result"]))).toBe(
                gcdReference(BigInt(a), BigInt(b)),
            );
        }
    });

    it("handles coprime, shared-factor, and reversed pairs", () => {
        for (const [a, b] of [
            ["1000000007", "998244353"],
            ["123456789012345678901234567890", "12345678901234567890"],
            ["17", "123456789012345678901234567890"],
            ["99999999999999999999", "99999999999999999999"],
        ]) {
            const frames = [...mod.run({ a, b })];
            expect(BigInt(String(frames[frames.length - 1]?.meta["result"]))).toBe(
                gcdReference(BigInt(a), BigInt(b)),
            );
        }
    });

    it("solves the default input", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const input = mod.defaultInput as { a: string; b: string };
        expect(BigInt(String(frames[frames.length - 1]?.meta["result"]))).toBe(
            gcdReference(BigInt(input.a), BigInt(input.b)),
        );
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
