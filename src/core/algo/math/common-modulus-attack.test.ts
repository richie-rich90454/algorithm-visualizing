/** common-modulus-attack.test.ts - Brute-force plaintext cross-check, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./common-modulus-attack";
import type { VisualFrame } from "@/types";

function pow(base: bigint, exp: bigint, mod: bigint): bigint {
    let r = 1n; let b = ((base % mod) + mod) % mod; let e = exp;
    while (e > 0n) { if (e & 1n) r = (r * b) % mod; b = (b * b) % mod; e >>= 1n; }
    return r;
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
        expect(frame.meta).toBeDefined();
    });
}

describe("Common Modulus Attack", () => {
    it("recovers every message against a brute-force search", () => {
        const cases = [
            { n: 3233, e1: 3, e2: 17 },
            { n: 3233, e1: 5, e2: 11 },
            { n: 10007 * 20011, e1: 3, e2: 7 },
            { n: 61 * 53, e1: 11, e2: 13 },
        ];
        for (const testCase of cases) {
            const n = BigInt(testCase.n);
            const e1 = BigInt(testCase.e1);
            const e2 = BigInt(testCase.e2);
            for (const message of [2n, 7n, 42n, 123n, 999n]) {
                if (message >= n) continue;
                const frames = [...mod.run({ ...testCase, message: Number(message) })];
                checkFrames(frames);
                const final = frames[frames.length - 1]?.meta;
                expect(final?.["recovered"]).toBe(message.toString());
                expect(final?.["matches"]).toBe(true);

                const c1 = pow(message, e1, n);
                const c2 = pow(message, e2, n);
                let brute: bigint | null = null;
                for (let candidate = 0n; candidate < n && candidate < 5000n; candidate += 1n) {
                    if (pow(candidate, e1, n) === c1 && pow(candidate, e2, n) === c2) { brute = candidate; break; }
                }
                expect(brute).toBe(message);
            }
        }
    });

    it("reports failure when the exponents are not coprime", () => {
        const frames = [...mod.run({ n: 3233, e1: 3, e2: 9, message: 42 })];
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
