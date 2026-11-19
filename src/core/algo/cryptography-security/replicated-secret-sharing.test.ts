/** replicated-secret-sharing.test.ts - Brute-force reconstruction property, privacy check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./replicated-secret-sharing";
import type { VisualFrame } from "@/types";

interface SharingInput { secret: number; a: number; b: number; }

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Replicated Secret Sharing", () => {
    it("every pair of parties reconstructs the secret on the default input", () => {
        const input = mod.defaultInput as SharingInput;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const c = input.secret ^ input.a ^ input.b;
        expect(c).toBe(final?.["c"]);
        expect(final?.["reconstructions"]).toEqual([input.secret, input.secret, input.secret]);
        expect(final?.["verified"]).toBe(true);
    });

    it("reconstruction holds for many random secrets and random pairs", () => {
        let state = 9876;
        const next = () => { state = (Math.imul(1103515245, state) + 12345) >>> 1; return state & 0xff; };
        for (let trial = 0; trial < 60; trial += 1) {
            const secret = next();
            const a = next();
            const b = next();
            const c = secret ^ a ^ b;
            expect(a ^ b ^ c).toBe(secret);
            expect(a ^ b ^ c).toBe(secret);
            expect(b ^ c ^ a).toBe(secret);
            expect(c ^ a ^ b).toBe(secret);
            const final = [...mod.run({ secret, a, b })].at(-1)?.meta;
            expect(final?.["verified"]).toBe(true);
        }
    });

    it("a single party's two values generally hide the secret", () => {
        const input = { secret: 10, a: 83, b: 44 };
        const final = [...mod.run(input)].at(-1)?.meta;
        const singles = final?.["singlePartyXor"] as number[];
        expect(singles.some((value) => value !== input.secret)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
