/**
 * damgard-jurik.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { djDecrypt, djEncrypt, djKey, djMultiply } from "./damgard-jurik";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 2);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(rows);
        expect(frame.meta["cols"]).toBe(2);
    });
}

describe("Damgard-Jurik Homomorphic Encryption (Toy)", () => {
    it("round-trips messages for several scales including Paillier (s=1)", () => {
        for (const scale of [1, 2, 3]) {
            const key = djKey(11n, 13n, scale);
            for (let m = 0; m < 40; m += 1) {
                const r = BigInt((m % 7) + 2);
                const cipher = djEncrypt(BigInt(m), r, key);
                expect(djDecrypt(cipher, key)).toBe(BigInt(m));
            }
        }
    });

    it("adds messages homomorphically with modular wraparound", () => {
        const key = djKey(11n, 13n, 2);
        const pairs: Array<[number, number]> = [[7, 5], [40, 60], [100, 100], [0, 0]];
        for (const [m1, m2] of pairs) {
            const c1 = djEncrypt(BigInt(m1), 3n, key);
            const c2 = djEncrypt(BigInt(m2), 5n, key);
            const sum = djDecrypt(djMultiply(c1, c2, key), key);
            expect(sum).toBe(BigInt((m1 + m2) % 143));
        }
    });

    it("is randomized by r but decrypts consistently", () => {
        const key = djKey(11n, 13n, 2);
        const ciphers = [2n, 3n, 5n, 7n, 9n].map((r) => djEncrypt(23n, r, key));
        expect(new Set(ciphers.map(String)).size).toBe(5);
        ciphers.forEach((cipher) => expect(djDecrypt(cipher, key)).toBe(23n));
    });

    it("emits well-formed frames with a consistent final meta", () => {
        const input = mod.defaultInput as {
            p: number; q: number; scale: number; m1: number; m2: number; r1: number; r2: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, 14);
        const key = djKey(BigInt(input.p), BigInt(input.q), input.scale);
        const c1 = djEncrypt(BigInt(input.m1), BigInt(input.r1), key);
        const c2 = djEncrypt(BigInt(input.m2), BigInt(input.r2), key);
        const meta = frames[frames.length - 1]!.meta;
        expect(meta["n"]).toBe(String(key.n));
        expect(meta["modulus"]).toBe(String(key.modulus));
        expect(meta["c1"]).toBe(String(c1));
        expect(meta["c2"]).toBe(String(c2));
        expect(meta["decrypted"]).toBe("12");
        expect(meta["expectedSum"]).toBe("12");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
