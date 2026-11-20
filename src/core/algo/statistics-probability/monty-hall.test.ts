/**
 * monty-hall.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./monty-hall";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], shownTrials: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
    expect(frames.length).toBe(1 + shownTrials * 4 + 1);
}

describe("Monty Hall", () => {
    it("matches exact enumeration over all nine car-pick pairs", () => {
        const input = { shownTrials: 2, sampleTrials: 6000, seed: 3 };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.shownTrials);
        const final = frames[frames.length - 1]!.meta;
        expect(final["exactSwitchRate"]).toBeCloseTo(2 / 3, 10);
        expect(final["exactStayRate"]).toBeCloseTo(1 / 3, 10);
        expect(Number(final["switchWins"]) + Number(final["stayWins"])).toBe(input.sampleTrials);
        expect(final["switchRate"] as number).toBeGreaterThan(0.6);
        expect(final["switchRate"] as number).toBeLessThan(0.72);
    });

    it("shown trials have a valid host reveal and consistent outcome", () => {
        const frames = [...mod.run({ shownTrials: 5, sampleTrials: 100, seed: 17 })];
        const trialFrames = frames.slice(1, 1 + 5 * 4);
        for (let i = 0; i < trialFrames.length; i += 4) {
            const placement = trialFrames[i]!.meta;
            const pickFrame = trialFrames[i + 1]!.meta;
            const reveal = trialFrames[i + 2]!.meta;
            const outcome = trialFrames[i + 3]!.meta;
            const car = placement["car"] as number;
            const pick = pickFrame["pick"] as number;
            const opened = reveal["opened"] as number;
            expect(opened).not.toBe(car);
            expect(opened).not.toBe(pick);
            expect(outcome["switchDoor"]).not.toBe(pick);
            expect(outcome["switchDoor"]).not.toBe(opened);
            expect(outcome["switchWin"]).toBe(outcome["switchDoor"] === car);
            expect(outcome["stayWin"]).toBe(pick === car);
            expect(Boolean(outcome["switchWin"])).not.toBe(Boolean(outcome["stayWin"]));
        }
    });

    it("is deterministic for a fixed seed", () => {
        const input = { shownTrials: 3, sampleTrials: 2000, seed: 9 };
        const a = [...mod.run(input)];
        const b = [...mod.run(input)];
        expect(a[a.length - 1]!.meta["switchWins"]).toBe(b[b.length - 1]!.meta["switchWins"]);
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
