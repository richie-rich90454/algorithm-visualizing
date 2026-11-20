/**
 * kyber-kem.test.ts - Independent LWE arithmetic, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./kyber-kem";
import type { VisualFrame } from "@/types";

const Q = 251;
const HALF = Math.floor(Q / 2);
const A = [[5, 7], [11, 3]];
const S = [3, -2];
const E = [1, -1];
const R = [2, -1];
const E1 = [1, 0];
const E2 = 1;
const md = (v: number): number => ((v % Q) + Q) % Q;
const dot = (a: number[], b: number[]): number => a.reduce((acc, v, i) => acc + v * (b[i] ?? 0), 0);

function reference(bit: number): { t: number[]; u: number[]; v: number; w: number; decoded: number } {
    const t = A.map((row, i) => md(dot(row, S) + (E[i] ?? 0)));
    const at = A[0]!.map((_, col) => A.map((row) => row[col] ?? 0));
    const u = at.map((row, i) => md(dot(row, R) + (E1[i] ?? 0)));
    const v = md(dot(t, R) + E2 + bit * HALF);
    const w = md(v - dot(S, u));
    return { t, u, v, w, decoded: w > HALF ? 1 : 0 };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(16);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(4);
        expect(frame.meta["cols"]).toBe(4);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("KyberKem", () => {
    it("matches independent LWE arithmetic for both bits", () => {
        for (const bit of [0, 1]) {
            const frames = [...mod.run({ bit })];
            checkFrames(frames);
            const expected = reference(bit);
            const final = frames[frames.length - 1];
            expect(final?.meta["t"]).toEqual(expected.t);
            expect(final?.meta["u"]).toEqual(expected.u);
            expect(Number(final?.meta["v"])).toBe(expected.v);
            expect(Number(final?.meta["w"])).toBe(expected.w);
            expect(Number(final?.meta["decoded"])).toBe(bit);
            expect(final?.meta["valid"]).toBe(true);

            const smallError = md(expected.w - bit * HALF);
            expect(Math.min(smallError, Q - smallError)).toBeLessThan(Q / 4);
        }
    });

    it("the public value satisfies t equals A s plus e", () => {
        const frames = [...mod.run({ bit: 1 })];
        const final = frames[frames.length - 1];
        const t = final?.meta["t"] as number[];
        A.forEach((row, i) => {
            expect(t[i]).toBe(md(dot(row, S) + (E[i] ?? 0)));
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
