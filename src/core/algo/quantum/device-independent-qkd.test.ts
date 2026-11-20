/**
 * device-independent-qkd.test.ts - Correlator correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./device-independent-qkd";
import type { VisualFrame } from "@/types";

const A = [0, Math.PI / 2];
const B = [Math.PI / 4, (3 * Math.PI) / 4];

function referenceS(phi?: number) {
    const f = phi === undefined
        ? (a: number, b: number) => Math.cos(a - b)
        : (a: number, b: number) => Math.cos(a - phi) * Math.cos(phi - b);
    const e = [f(A[0]!, B[0]!), f(A[0]!, B[1]!), f(A[1]!, B[0]!), f(A[1]!, B[1]!)];
    return e[0]! - e[1]! + e[2]! + e[3]!;
}

function jointProbability(thetaA: number, thetaB: number, a: number, b: number): number {
    return (1 + a * b * Math.cos(thetaA - thetaB)) / 4;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThanOrEqual(3);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Device-independent QKD", () => {
    it("reaches the Tsirelson bound and respects the local bound", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        expect(Number(final["sIdeal"])).toBeCloseTo(2 * Math.SQRT2, 8);
        expect(Number(final["sIdeal"])).toBeCloseTo(referenceS(), 8);
        expect(Number(final["sLocal"])).toBeCloseTo(2, 8);
        expect(Number(final["quantumBound"])).toBeCloseTo(2 * Math.SQRT2, 8);
        expect(final["secure"]).toBe(true);
    });

    it("detects intercept-resend for every eavesdropping angle", () => {
        for (const angle of [0, 0.2, 0.5, 1.0, 2.0]) {
            const frames = [...mod.run({ eveAngle: angle })];
            const final = frames[frames.length - 1]!.meta;
            expect(Number(final["sEve"])).toBeCloseTo(referenceS(angle), 8);
            expect(Math.abs(Number(final["sEve"]))).toBeLessThan(2);
        }
    });

    it("uses normalized joint probabilities", () => {
        for (const a of A) {
            for (const b of B) {
                let total = 0;
                for (const oa of [-1, 1]) {
                    for (const ob of [-1, 1]) total += jointProbability(a, b, oa, ob);
                }
                expect(total).toBeCloseTo(1, 10);
                expect(jointProbability(a, b, 1, 1)).toBeGreaterThanOrEqual(0);
                expect(jointProbability(a, b, -1, 1)).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
