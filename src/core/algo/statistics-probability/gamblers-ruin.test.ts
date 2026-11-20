/**
 * gamblers-ruin.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./gamblers-ruin";
import type { VisualFrame } from "@/types";

/** Independent closed-form ruin probability. */
function closedForm(i: number, target: number, p: number): number {
    if (p === 0.5) {
        return (target - i) / target;
    }
    const r = (1 - p) / p;
    return (Math.pow(r, i) - Math.pow(r, target)) / (1 - Math.pow(r, target));
}

function checkFrames(frames: VisualFrame[], target: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(target + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Gambler's ruin", () => {
    it("matches the closed form for fair and unfair games", () => {
        const cases = [
            { capital: 5, target: 10, p: 0.5 },
            { capital: 3, target: 12, p: 0.4 },
            { capital: 8, target: 15, p: 0.6 },
            { capital: 1, target: 20, p: 0.3 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.target);
            const final = frames[frames.length - 1]!.meta;
            expect(final["ruinProbability"]).toBeCloseTo(closedForm(input.capital, input.target, input.p), 8);
            const curve = final["ruinProbabilities"] as number[];
            expect(curve[0]).toBeCloseTo(1, 10);
            expect(curve[input.target]).toBeCloseTo(0, 10);
            for (let i = 1; i < input.target; i += 1) {
                const expected = closedForm(i, input.target, input.p);
                expect(curve[i] as number).toBeCloseTo(expected, 7);
            }
        }
    });

    it("respects the interior recurrence and monotonicity", () => {
        const target = 10;
        const p = 0.5;
        const frames = [...mod.run({ capital: 4, target, p })];
        const curve = frames[frames.length - 1]!.meta["ruinProbabilities"] as number[];
        for (let i = 1; i < target; i += 1) {
            const recurrence = (1 - p) * (curve[i - 1] as number) + p * (curve[i + 1] as number);
            expect(curve[i] as number).toBeCloseTo(recurrence, 8);
        }
        for (let i = 1; i <= target; i += 1) {
            expect(curve[i] as number).toBeLessThanOrEqual(curve[i - 1] as number);
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
