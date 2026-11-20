/**
 * elgamal-additive.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, {
    additiveDecrypt,
    additiveEncrypt,
    additiveMultiply,
    additivePublicKey,
} from "./elgamal-additive";
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

describe("Additive ElGamal Encryption (Toy)", () => {
    it("decrypts individual messages and homomorphic sums", () => {
        const p = 101n;
        const g = 2n;
        const a = 7n;
        const h = additivePublicKey(p, g, a);
        expect(h).toBe(27n);

        for (let m = 0; m < 30; m += 1) {
            const r = BigInt((m % 9) + 1);
            const cipher = additiveEncrypt(p, g, h, BigInt(m), r);
            expect(additiveDecrypt(p, g, a, cipher)).toBe(BigInt(m));
        }

        const c1 = additiveEncrypt(p, g, h, 7n, 3n);
        const c2 = additiveEncrypt(p, g, h, 5n, 4n);
        expect(additiveDecrypt(p, g, a, additiveMultiply(p, c1, c2))).toBe(12n);
    });

    it("is randomized by r but always decrypts to the same message", () => {
        const p = 101n;
        const g = 2n;
        const a = 11n;
        const h = additivePublicKey(p, g, a);
        const ciphers = [1n, 2n, 3n, 4n, 5n].map((r) => additiveEncrypt(p, g, h, 9n, r));
        expect(new Set(ciphers.map((c) => c.c1.toString())).size).toBe(5);
        ciphers.forEach((cipher) => expect(additiveDecrypt(p, g, a, cipher)).toBe(9n));
    });

    it("emits well-formed frames whose final meta matches a fresh computation", () => {
        const input = mod.defaultInput as {
            p: number; g: number; a: number; m1: number; m2: number; r1: number; r2: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, 15);
        const meta = frames[frames.length - 1]!.meta;
        const p = BigInt(input.p), g = BigInt(input.g), a = BigInt(input.a);
        const h = additivePublicKey(p, g, a);
        const c1 = additiveEncrypt(p, g, h, BigInt(input.m1), BigInt(input.r1));
        const c2 = additiveEncrypt(p, g, h, BigInt(input.m2), BigInt(input.r2));
        const combined = additiveMultiply(p, c1, c2);
        expect(meta["h"]).toBe(String(h));
        expect(meta["c1"]).toBe(String(c1.c1));
        expect(meta["c2"]).toBe(String(c1.c2));
        expect(meta["combinedC1"]).toBe(String(combined.c1));
        expect(meta["combinedC2"]).toBe(String(combined.c2));
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
