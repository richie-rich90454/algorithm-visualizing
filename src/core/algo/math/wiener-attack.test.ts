/** wiener-attack.test.ts - Brute-force inverse cross-check, factorization check, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./wiener-attack";
import type { VisualFrame } from "@/types";

function egcd(a: bigint, b: bigint): { g: bigint; x: bigint } {
    let oldR = a; let r = b; let oldS = 1n; let s = 0n;
    while (r !== 0n) {
        const q = oldR / r;
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
    }
    return { g: oldR, x: oldS };
}
function inv(a: bigint, m: bigint): bigint {
    const { g, x } = egcd(((a % m) + m) % m, m);
    if (g !== 1n) throw new Error("not invertible");
    return ((x % m) + m) % m;
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["n"]).toBeDefined();
    });
}

describe("Wiener Small-d Attack", () => {
    it("recovers the private exponent by brute-force inverse cross-check", () => {
        const p = 10007n;
        const q = 20011n;
        const n = p * q;
        const phi = (p - 1n) * (q - 1n);
        for (const smallD of [3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
            if (egcd(smallD, phi).g !== 1n) continue;
            const frames = [...mod.run({ p: Number(p), q: Number(q), d: Number(smallD) })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["recovered"]).toBe(true);
            expect(BigInt(final?.["recoveredD"] as string)).toBe(smallD);

            const e = inv(smallD, phi);
            let brute = 0n;
            for (let candidate = 1n; candidate < 1000n; candidate += 1n) {
                if ((e * candidate - 1n) % phi === 0n) { brute = candidate; break; }
            }
            expect(brute).toBe(smallD);
            expect(BigInt(final?.["p"] as string) * BigInt(final?.["q"] as string)).toBe(n);
            expect([final?.["p"], final?.["q"]].sort()).toEqual([p.toString(), q.toString()].sort());
        }
    });

    it("reports failure for an exponent outside the Wiener bound", () => {
        const frames = [...mod.run({ p: 10007, q: 20011, d: 99991 })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["recovered"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
