import { describe, expect, it } from "vitest";
import mod from "./stirling-numbers";
import type { VisualFrame } from "@/types";

function factorial(n: number): number {
    let r = 1;
    for (let i = 2; i <= n; i += 1) r *= i;
    return r;
}
function choose(n: number, k: number): number {
    if (k < 0 || k > n) return 0;
    return factorial(n) / (factorial(k) * factorial(n - k));
}
function reference(n: number, k: number): number {
    let sum = 0;
    for (let j = 0; j <= k; j += 1) sum += ((k - j) % 2 === 0 ? 1 : -1) * choose(k, j) * Math.pow(j, n);
    return Math.round(sum / factorial(k));
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

describe("Stirling Numbers of the Second Kind", () => {
    it("matches the explicit summation formula", () => {
        for (const [n, k] of [[0, 0], [4, 2], [5, 2], [6, 3], [8, 4], [10, 5], [7, 7], [7, 1]] as [number, number][]) {
            const frames = [...mod.run({ n, k })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["result"]).toBe(reference(n, Math.min(k, n)));
        }
    });

    it("satisfies boundary values and Bell number sum", () => {
        const n = 6;
        let bell = 0;
        for (let k = 0; k <= n; k += 1) {
            const frames = [...mod.run({ n, k })];
            const value = frames[frames.length - 1]?.meta["result"] as number;
            bell += value;
            if (k === 1 || k === n) expect(value).toBe(1);
        }
        expect(bell).toBe(203);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
