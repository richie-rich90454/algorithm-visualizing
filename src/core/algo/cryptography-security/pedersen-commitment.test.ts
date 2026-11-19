/** pedersen-commitment.test.ts - Independent BigInt reference, exhaustive binding, homomorphism, frame shape. */

import { describe, expect, it } from "vitest";
import mod, { aggregate, commit, open, powMod } from "./pedersen-commitment";
import type { VisualFrame } from "@/types";

const P = 1000003n;
function bigPow(base: number, exponent: number): number {
    let result = 1n;
    let b = BigInt(base) % P;
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) { result = (result * b) % P; }
        b = (b * b) % P;
        e = Math.floor(e / 2);
    }
    return Number(result);
}
const refCommit = (m: number, r: number): number => Number((BigInt(bigPow(2, m)) * BigInt(bigPow(3, r))) % P);

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Pedersen Commitment (toy field)", () => {
    it("matches an independent BigInt exponentiation reference", () => {
        for (let base = 1; base < 20; base += 1) {
            for (let exp = 0; exp < 40; exp += 1) {
                expect(powMod(base, exp, 1000003)).toBe(bigPow(base, exp));
            }
        }
        for (let m = 0; m < 30; m += 1) {
            for (let r = 0; r < 30; r += 1) {
                expect(commit(m, r)).toBe(refCommit(m, r));
            }
        }
    });

    it("is binding on a brute-forced small domain and hides the message", () => {
        const seen = new Map<string, [number, number]>();
        for (let m = 0; m < 10; m += 1) {
            const withDifferentBlinders = new Set<number>();
            for (let r = 0; r < 10; r += 1) {
                const c = commit(m, r);
                withDifferentBlinders.add(c);
                const key = String(c);
                expect(seen.has(key)).toBe(false);
                seen.set(key, [m, r]);
            }
            expect(withDifferentBlinders.size).toBe(10);
        }
        expect(seen.size).toBe(100);
    });

    it("opens correctly, rejects wrong openings, and is homomorphic", () => {
        for (let m = 0; m < 15; m += 1) {
            for (let r = 0; r < 15; r += 1) {
                const c = commit(m, r);
                expect(open(c, m, r)).toBe(true);
                expect(open(c, m + 1, r)).toBe(false);
                expect(open(c, m, r + 1)).toBe(false);
                for (let m2 = 0; m2 < 6; m2 += 1) {
                    for (let r2 = 0; r2 < 6; r2 += 1) {
                        expect(aggregate(c, commit(m2, r2))).toBe(commit(m + m2, r + r2));
                    }
                }
            }
        }
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["opened"]).toBe(true);
        expect(final?.meta["homomorphic"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
