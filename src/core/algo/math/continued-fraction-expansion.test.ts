/** continued-fraction-expansion.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./continued-fraction-expansion";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Build convergents from a partial quotient list and test the Pell identity. */
function hasFundamentalSolution(D: number, a0: number, partials: number[]): boolean {
    const all = [a0, ...partials, ...partials, ...partials];
    let pPrev2 = 0n;
    let pPrev1 = 1n;
    let qPrev2 = 1n;
    let qPrev1 = 0n;
    for (let i = 0; i < all.length; i += 1) {
        const a = BigInt(all[i] as number);
        const p = a * pPrev1 + pPrev2;
        const q = a * qPrev1 + qPrev2;
        pPrev2 = pPrev1;
        pPrev1 = p;
        qPrev2 = qPrev1;
        qPrev1 = q;
        if (p * p - BigInt(D) * q * q === 1n) {
            return true;
        }
    }
    return false;
}

describe("Continued Fraction Expansion", () => {
    it("produces periods whose convergents solve Pell's equation", () => {
        for (let D = 2; D <= 200; D += 1) {
            if (Number.isInteger(Math.sqrt(D))) {
                continue;
            }
            const frames = [...mod.run({ D })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const a0 = Number(final?.["a0"]);
            const partials = final?.["partials"] as number[];
            expect(partials.length, `period for ${D}`).toBe(final?.["period"]);
            expect(partials[partials.length - 1]).toBe(2 * a0);
            expect(hasFundamentalSolution(D, a0, partials), `Pell convergent for ${D}`).toBe(true);
        }
    });

    it("matches the known period of sqrt(23)", () => {
        const frames = [...mod.run({ D: 23 })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["a0"]).toBe(4);
        expect(final?.["partials"]).toEqual([1, 3, 1, 8]);
        expect(final?.["period"]).toBe(4);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
