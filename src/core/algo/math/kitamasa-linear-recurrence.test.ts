/** kitamasa-linear-recurrence.test.ts - Iteration cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./kitamasa-linear-recurrence";
import type { VisualFrame } from "@/types";

function iterate(c: number[], initial: number[], n: number): number {
    const d = c.length;
    const seq = initial.slice(0, d);
    for (let i = d; i <= n; i += 1) {
        let next = 0;
        for (let j = 1; j <= d; j += 1) next += c[j - 1]! * seq[i - j]!;
        seq.push(next);
    }
    return seq[n]!;
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Kitamasa linear recurrence", () => {
    it("matches direct iteration on several recurrences and indices", () => {
        const cases = [
            { coefficients: [1, 1], initial: [0, 1], n: 30 },
            { coefficients: [2, 1], initial: [1, 1], n: 20 },
            { coefficients: [1, 0, 1], initial: [0, 1, 1], n: 40 },
            { coefficients: [3, -2, 5, 1], initial: [1, 2, 0, 4], n: 25 },
            { coefficients: [1], initial: [7], n: 12 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            expect(final["term"]).toBe(iterate(input.coefficients, input.initial, input.n));
            expect(final["bruteTerm"]).toBe(final["term"]);
            expect(final["n"]).toBe(input.n);
        }
    });

    it("handles n equals zero and invalid input without throwing", () => {
        const zero = [...mod.run({ coefficients: [1, 1], initial: [3, 5], n: 0 })];
        expect(zero[zero.length - 1]!.meta["term"]).toBe(3);
        const bad = [...mod.run({ coefficients: [], initial: [], n: 5 })];
        expect(bad[0]!.meta["valid"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
