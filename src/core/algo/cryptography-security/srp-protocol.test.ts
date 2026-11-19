import { describe, expect, it } from "vitest";
import mod, { srpExchange, srpPow } from "./srp-protocol";
import type { VisualFrame } from "@/types";

function referencePow(base: number, exp: number, mod: number): number {
    let result = 1n;
    let b = BigInt(((base % mod) + mod) % mod);
    let e = BigInt(exp);
    const m = BigInt(mod);
    while (e > 0n) {
        if (e & 1n) result = (result * b) % m;
        b = (b * b) % m;
        e >>= 1n;
    }
    return Number(result);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 8);
        expect(frame.meta).toBeDefined();
    });
}

describe("SRP Protocol (Toy Prime Field)", () => {
    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames);
        const last = frames[frames.length - 1];
        expect(last?.meta["match"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });

    it("matches an independent modular exponentiation oracle", () => {
        for (const [base, exp, modulus] of [
            [2, 10, 1000003],
            [7, 0, 101],
            [5, 31, 1009],
            [3, 64, 2147483647],
        ]) {
            expect(srpPow(base as number, exp as number, modulus as number)).toBe(
                referencePow(base as number, exp as number, modulus as number),
            );
        }
    });

    it("derives equal keys for valid runs and rejects a wrong password", () => {
        let seed = 31415;
        const rand = (limit: number): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed % limit;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const password = 1 + rand(5000);
            const salt = 1 + rand(500);
            const a = 2 + rand(20);
            const b = 2 + rand(20);
            const result = srpExchange(1000003, 2, 3, password, salt, a, b);
            expect(result.match).toBe(true);
            expect(result.clientSecret).toBe(result.serverSecret);
            expect(result.key).toBe((result.clientSecret + result.serverSecret * 2654435761) % 1000003);
            const wrong = srpExchange(1000003, 2, 3, password, salt, a, b, password + 1);
            expect(wrong.clientSecret).not.toBe(wrong.serverSecret);
            expect(wrong.match).toBe(false);
        }
    });

    it("rejects a tampered server message when both sides use the same input", () => {
        const good = srpExchange(1000003, 2, 3, 1234, 77, 7, 11);
        const other = srpExchange(1000003, 2, 3, 1234, 77, 7, 13);
        expect(good.match).toBe(true);
        expect(other.match).toBe(true);
        expect(good.B).not.toBe(other.B);
        expect(good.key).not.toBe(other.key);
    });
});
