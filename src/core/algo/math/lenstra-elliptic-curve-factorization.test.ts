import { describe, expect, it } from "vitest";
import mod from "./lenstra-elliptic-curve-factorization";
import type { VisualFrame } from "@/types";

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

describe("Lenstra Elliptic Curve Factorization", () => {
    it("finds a verified nontrivial factor on the default", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const n = 455839;
        const factor = frames[frames.length - 1]?.meta["factor"] as number;
        expect(factor).toBeGreaterThan(1);
        expect(factor).toBeLessThan(n);
        expect(n % factor).toBe(0);
        expect(frames[frames.length - 1]?.meta["cofactor"]).toBe(n / factor);
    });

    it("the reported factor multiplies back to n", () => {
        const input = { n: 455839, a: 1, x: 3, y: 1, B1: 10 };
        const final = [...mod.run(input)][0]?.meta;
        void final;
        const frames = [...mod.run(input)];
        const factor = frames[frames.length - 1]?.meta["factor"] as number;
        const cofactor = frames[frames.length - 1]?.meta["cofactor"] as number;
        expect(factor * cofactor).toBe(input.n);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
