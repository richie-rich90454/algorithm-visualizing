/**
 * blum-blum-shub.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./blum-blum-shub";
import type { VisualFrame } from "@/types";

/** Independent recurrence replay. */
function reference(p: number, q: number, seed: number, bits: number): number[] {
    const n = p * q;
    let x = ((seed % n) + n) % n;
    const out: number[] = [];
    for (let i = 0; i < bits; i += 1) {
        x = (x * x) % n;
        out.push(x & 1);
    }
    return out;
}

function checkFrames(frames: VisualFrame[], bits: number): void {
    expect(frames.length).toBe(bits + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(bits);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Blum-Blum-Shub", () => {
    it("matches an independent squaring recurrence at every step", () => {
        const input = mod.defaultInput as { p: number; q: number; seed: number; bits: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.bits);
        const n = input.p * input.q;
        let x = ((input.seed % n) + n) % n;
        for (let i = 0; i < input.bits; i += 1) {
            x = (x * x) % n;
            const frame = frames[i + 1];
            expect(Number(frame?.meta["x"])).toBe(x);
            expect(Number(frame?.meta["bit"])).toBe(x & 1);
        }
        const expectedBits = reference(input.p, input.q, input.seed, input.bits);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["bits"]).toEqual(expectedBits);
    });

    it("is deterministic and seed-sensitive", () => {
        const options = { p: 11, q: 23, bits: 12 };
        const a = [...mod.run({ ...options, seed: 3 })].slice(-1)[0]?.meta["bits"];
        const again = [...mod.run({ ...options, seed: 3 })].slice(-1)[0]?.meta["bits"];
        const b = [...mod.run({ ...options, seed: 7 })].slice(-1)[0]?.meta["bits"];
        expect(a).toEqual(again);
        expect(a).not.toEqual(b);
    });

    it("only uses Blum primes and keeps states inside the modulus", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (const frame of frames) {
            const n = Number(frame.meta["n"]);
            expect(n).toBe(11 * 23);
            expect(Number(frame.meta["x"])).toBeGreaterThanOrEqual(0);
            expect(Number(frame.meta["x"])).toBeLessThan(n);
            const bit = Number(frame.meta["bit"]);
            expect(bit === 0 || bit === 1).toBe(true);
        }
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
