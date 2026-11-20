import { describe, expect, it } from "vitest";
import mod from "./fibonacci-fast-doubling";
import type { VisualFrame } from "@/types";

function reference(n: number): number {
    let a = 0, b = 1;
    for (let i = 0; i < n; i += 1) { const t = a + b; a = b; b = t; }
    return a;
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

describe("Fibonacci Fast Doubling", () => {
    it("matches an iterative Fibonacci reference", () => {
        for (const n of [0, 1, 2, 3, 10, 20, 40, 50]) {
            const frames = [...mod.run({ n })];
            checkFrames(frames);
            const result = frames[frames.length - 1]?.meta["result"];
            expect(result).toBe(reference(n));
            expect(frames[frames.length - 1]?.meta["next"]).toBe(reference(n + 1));
        }
    });

    it("returns F(10) = 55 on the default", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames[frames.length - 1]?.meta["result"]).toBe(55);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
