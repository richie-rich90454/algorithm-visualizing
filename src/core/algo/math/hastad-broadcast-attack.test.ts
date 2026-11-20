/** hastad-broadcast-attack.test.ts - Brute-force message cross-check, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./hastad-broadcast-attack";
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
        expect(frame.meta["moduli"]).toBeDefined();
    });
}

describe("Hastad Broadcast Attack", () => {
    it("recovers messages against a brute-force search", () => {
        const cases = [
            { moduli: [101, 103, 107], exponent: 3 },
            { moduli: [11, 13, 17], exponent: 3 },
            { moduli: [101, 103, 107, 109], exponent: 4 },
        ];
        for (const testCase of cases) {
            const e = BigInt(testCase.exponent);
            const moduli = testCase.moduli.map(BigInt);
            const bound = moduli.reduce((acc, n) => acc * n, 1n);
            for (const message of [2n, 7n, 42n, 80n]) {
                if (message ** e >= bound) continue;
                const frames = [...mod.run({ ...testCase, message: Number(message) })];
                checkFrames(frames);
                const final = frames[frames.length - 1]?.meta;
                expect(final?.["verified"]).toBe(true);
                expect(final?.["correct"]).toBe(true);
                expect(final?.["recovered"]).toBe(message.toString());

                const ciphertexts = moduli.map((n) => pow(message, e, n));
                let brute: bigint | null = null;
                for (let candidate = 0n; candidate < 200n; candidate += 1n) {
                    if (ciphertexts.every((c, i) => pow(candidate, e, moduli[i]!) === c)) { brute = candidate; break; }
                }
                expect(brute).toBe(message);
            }
        }
    });

    it("reports an inconclusive result when the message is too large", () => {
        const frames = [...mod.run({ moduli: [101, 103, 107], exponent: 3, message: 100000 })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["verified"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
