/**
 * opaque-pake.test.ts - OPRF core correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./opaque-pake";
import type { VisualFrame } from "@/types";

const modv = (value: number, m: number): number => ((value % m) + m) % m;

function modPow(base: number, exponent: number, m: number): number {
    let result = 1;
    let b = modv(base, m);
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) {
            result = modv(result * b, m);
        }
        b = modv(b * b, m);
        e = Math.floor(e / 2);
    }
    return result;
}

function hash(password: string, p: number): number {
    let sum = 0;
    for (let i = 0; i < password.length; i += 1) {
        sum += password.charCodeAt(i);
    }
    return modv(sum, p - 1) + 1;
}

function checkFrames(frames: VisualFrame[], bars: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(bars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("OPAQUE OPRF core", () => {
    it("unblinding equals direct OPRF evaluation", () => {
        const input = mod.defaultInput as { p: number; k: number; password: string; r: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, 6);
        const final = frames[frames.length - 1]?.meta;
        const h = hash(input.password, input.p);
        expect(final?.["unblinded"]).toBe(modPow(h, input.k, input.p));
        expect(final?.["direct"]).toBe(modPow(h, input.k, input.p));
        expect(final?.["match"]).toBe(true);
    });

    it("different passwords give different OPRF outputs", () => {
        const a = [...mod.run({ p: 101, k: 13, password: "hunter2", r: 7 })].pop()?.meta["unblinded"];
        const b = [...mod.run({ p: 101, k: 13, password: "wrongpw", r: 7 })].pop()?.meta["unblinded"];
        expect(a).not.toBe(b);
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
