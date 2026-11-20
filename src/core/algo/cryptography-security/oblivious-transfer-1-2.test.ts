/**
 * oblivious-transfer-1-2.test.ts - RSA OT correctness, privacy property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./oblivious-transfer-1-2";
import type { VisualFrame } from "@/types";

interface Input {
    m0: number;
    m1: number;
    choice: 0 | 1;
    x0: number;
    x1: number;
    k: number;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(5);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function finalMeta(input: Input) {
    const frames = [...mod.run(input)];
    checkFrames(frames);
    return frames[frames.length - 1]?.meta ?? {};
}

describe("1-out-of-2 oblivious transfer (toy)", () => {
    it("delivers exactly the chosen message for both choices", () => {
        for (const choice of [0, 1] as const) {
            const input = { ...(mod.defaultInput as Input), choice };
            const meta = finalMeta(input);
            expect(Number(meta["recovered"])).toBe(choice === 0 ? input.m0 : input.m1);
            expect(Number(meta["otherMessage"])).toBe(choice === 0 ? input.m1 : input.m0);
        }
    });

    it("hides the unchosen message under the receiver's key", () => {
        for (const choice of [0, 1] as const) {
            const input = { ...(mod.defaultInput as Input), choice };
            const meta = finalMeta(input);
            const k = input.k % 100;
            const c0 = Number(meta["c0"]);
            const c1 = Number(meta["c1"]);
            const wrong = ((choice === 0 ? c1 : c0) - k + 100) % 100;
            const unchosen = choice === 0 ? input.m1 : input.m0;
            expect(wrong).not.toBe(unchosen);
        }
    });

    it("produces a different blinded value for the two choices", () => {
        const a = finalMeta({ ...(mod.defaultInput as Input), choice: 0 });
        const b = finalMeta({ ...(mod.defaultInput as Input), choice: 1 });
        expect(a["v"]).not.toBe(b["v"]);
    });

    it("the sender roots are RSA inverses of the receiver blinding", () => {
        const input = mod.defaultInput as Input;
        const meta = finalMeta(input);
        const k0 = Number(meta["k0"]);
        const k1 = Number(meta["k1"]);
        expect(k0 % 100).toBe(input.k % 100);
        expect(k1 % 100).not.toBe(input.k % 100);
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
