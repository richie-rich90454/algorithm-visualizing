/**
 * asmuth-bloom-secret-sharing.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, {
    asmuthBloomRecover,
    asmuthBloomShare,
    crtSolve,
} from "./asmuth-bloom-secret-sharing";
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

describe("Asmuth-Bloom Secret Sharing (Toy)", () => {
    it("solves CRT systems exactly", () => {
        expect(crtSolve([2n, 3n, 2n], [5n, 7n, 11n])).toBe(332n);
        for (let x = 0; x < 500; x += 1) {
            const moduli = [11n, 13n, 17n];
            const residues = moduli.map((m) => BigInt(x) % m);
            expect(crtSolve(residues, moduli)).toBe(BigInt(x));
        }
    });

    it("recovers the secret from every valid threshold subset", () => {
        const moduli = [7n, 11n, 13n, 17n];
        const bound = 11n * 13n; // product of the smallest t = 2 share moduli
        for (let secret = 0; secret < 7; secret += 1) {
            for (let r = 0; r <= 19; r += 3) {
                const { y, shares } = asmuthBloomShare(BigInt(secret), moduli, BigInt(r));
                expect(y).toBe(BigInt(secret) + BigInt(r) * 7n);
                expect(y).toBeLessThan(bound);
                for (let i = 0; i < shares.length; i += 1) {
                    for (let j = i + 1; j < shares.length; j += 1) {
                        expect(asmuthBloomRecover([shares[i]!, shares[j]!], moduli)).toBe(BigInt(secret));
                    }
                }
                expect(asmuthBloomRecover(shares, moduli)).toBe(BigInt(secret));
            }
        }
    });

    it("usually fails with fewer than the threshold shares", () => {
        const moduli = [7n, 11n, 13n, 17n];
        const { shares } = asmuthBloomShare(5n, moduli, 42n);
        for (const share of shares) {
            expect(asmuthBloomRecover([share], moduli)).not.toBe(5n);
        }
    });

    it("emits well-formed frames with a consistent final meta", () => {
        const input = mod.defaultInput as { secret: number; moduli: number[]; threshold: number; r: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, 8);
        const meta = frames[frames.length - 1]!.meta;
        const moduli = input.moduli.map(BigInt);
        const usedR = BigInt(String(meta["r"]));
        const { y, shares } = asmuthBloomShare(BigInt(input.secret), moduli, usedR);
        expect(meta["y"]).toBe(String(y));
        expect(meta["shares"]).toEqual(shares.map((s) => String(s.value)));
        expect(meta["recovered"]).toBe(String(input.secret));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
