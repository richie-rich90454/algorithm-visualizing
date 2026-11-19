/** reparameterization-trick.test.ts - Reference match, zero-variance property, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./reparameterization-trick";
import type { VisualFrame } from "@/types";

interface Input {
    mu: number[];
    sigma: number[];
    epsilon: number[];
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Reparameterization Trick", () => {
    it("matches the direct mu plus sigma times epsilon formula", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const z = final?.["z"] as number[];
        z.forEach((value, i) => {
            const expected = (input.mu[i] ?? 0) + (input.sigma[i] ?? 0) * (input.epsilon[i] ?? 0);
            expect(close(value, expected)).toBe(true);
        });
        expect(final?.["dzdmu"]).toEqual(new Array(input.mu.length).fill(1));
        expect(final?.["dzsigma"]).toEqual(input.epsilon.slice(0, input.mu.length));
    });

    it("collapses to the mean when sigma is zero", () => {
        const frames = [...mod.run({ mu: [2, -3, 5], sigma: [0, 0, 0], epsilon: [9, 9, 9] })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["z"]).toEqual([2, -3, 5]);
    });

    it("scales noise linearly with sigma", () => {
        const small = [...mod.run({ mu: [0], sigma: [1], epsilon: [2] })].at(-1)?.meta["z"];
        const large = [...mod.run({ mu: [0], sigma: [3], epsilon: [2] })].at(-1)?.meta["z"];
        expect(small).toEqual([2]);
        expect(large).toEqual([6]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
