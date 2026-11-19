/**
 * power-of-two-choices.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { lcgStep } from "./power-of-two-choices";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], bins: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(bins);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent replay of the same seeded greedy process. */
function reference(balls: number, bins: number, seed: number) {
    let s = seed >>> 0;
    const loads = new Array<number>(bins).fill(0);
    const steps: Array<{ first: number; second: number; chosen: number }> = [];
    for (let b = 0; b < balls; b += 1) {
        s = lcgStep(s);
        const first = s % bins;
        s = lcgStep(s);
        const second = s % bins;
        const chosen = loads[first]! <= loads[second]! ? first : second;
        loads[chosen]! += 1;
        steps.push({ first, second, chosen });
    }
    return { loads, steps };
}

describe("Power of Two Choices Load Balancing", () => {
    it("matches an independent replay and keeps valid loads", () => {
        const input = mod.defaultInput as { balls: number; bins: number; seed: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.bins);
        const expected = reference(input.balls, input.bins, input.seed);

        // One setup frame, one frame per ball, one summary frame.
        expect(frames.length).toBe(input.balls + 2);
        const finalMeta = frames[frames.length - 1]!.meta;
        expect(finalMeta["loads"]).toEqual(expected.loads);
        expect(finalMeta["maxLoad"]).toBe(Math.max(...expected.loads));
        expect((finalMeta["loads"] as number[]).reduce((a, b) => a + b, 0)).toBe(input.balls);

        // Each placement must have chosen the less loaded of its two probes.
        for (let i = 0; i < expected.steps.length; i += 1) {
            const meta = frames[i + 1]!.meta;
            expect(meta["probes"]).toEqual([expected.steps[i]!.first, expected.steps[i]!.second]);
            expect(meta["chosen"]).toBe(expected.steps[i]!.chosen);
            const priorLoads = frames[i]!.meta["loads"] as number[];
            const first = expected.steps[i]!.first;
            const second = expected.steps[i]!.second;
            const chosen = expected.steps[i]!.chosen;
            expect(priorLoads[chosen]!).toBeLessThanOrEqual(priorLoads[chosen === first ? second : first]!);
        }
    });

    it("is deterministic and flatter than a single random choice", () => {
        const input = { balls: 4000, bins: 400, seed: 7 };
        const a = [...mod.run(input)];
        const b = [...mod.run(input)];
        expect(a[a.length - 1]!.meta["loads"]).toEqual(b[b.length - 1]!.meta["loads"]);

        // Greedy-of-two should keep the maximum load well below the average-plus-large-margin
        // that a purely single random placement would occasionally produce.
        const maxLoad = Number(a[a.length - 1]!.meta["maxLoad"]);
        expect(maxLoad).toBeLessThanOrEqual(20);
        expect(maxLoad).toBeGreaterThanOrEqual(Math.ceil(input.balls / input.bins));
    });

    it("handles zero balls and one bin and terminates", () => {
        const empty = [...mod.run({ balls: 0, bins: 3, seed: 1 })];
        checkFrames(empty, 3);
        expect(empty[empty.length - 1]!.meta["maxLoad"]).toBe(0);

        const one = [...mod.run({ balls: 5, bins: 1, seed: 9 })];
        checkFrames(one, 1);
        expect(one[one.length - 1]!.meta["loads"]).toEqual([5]);

        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
