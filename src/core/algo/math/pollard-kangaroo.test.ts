import { describe, expect, it } from "vitest";
import mod from "./pollard-kangaroo";
import type { VisualFrame } from "@/types";

function modPow(base: number, exp: number, mod: number): number {
    let r = 1, x = base % mod, e = exp;
    while (e > 0) { if (e % 2 === 1) r = (r * x) % mod; x = (x * x) % mod; e = Math.floor(e / 2); }
    return r;
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Pollard Kangaroo", () => {
    it("recovers a known discrete logarithm on the default", () => {
        const input = mod.defaultInput as { p: number; g: number; x: number; bound: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["found"]).not.toBe(false);
        expect(final?.["result"]).toBe(input.x);
        expect(final?.["verified"]).toBe(true);
        expect(modPow(input.g, final?.["result"] as number, input.p)).toBe(modPow(input.g, input.x, input.p));
    });

    it("recovers another log in a small group", () => {
        const input = { p: 101, g: 2, x: 5, bound: 20 };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["result"]).toBe(input.x);
        expect(modPow(input.g, final?.["result"] as number, input.p)).toBe(modPow(input.g, input.x, input.p));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
