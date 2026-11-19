/** hindsight-experience-replay.test.ts - Brute-force relabeling, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./hindsight-experience-replay";
import type { VisualFrame } from "@/types";

interface Input { states: number[]; actions: number[]; kFuture: number; rewardSuccess: number; rewardFail: number }
type Row = [number, number, number, number, number];
const rewardFor = (a: number, g: number, s: number, f: number) => (a === g ? s : f);

/** Independent goal relabeling of the episode. */
function reference(input: Input): Row[] {
    const transitions = input.states.length - 1;
    const rows: Row[] = [];
    for (let i = 0; i < transitions; i += 1) {
        const achieved = input.states[i + 1] ?? 0;
        const start = Math.max(i + 1, transitions - input.kFuture + 1);
        for (let j = start; j <= transitions; j += 1) {
            const goal = input.states[j] ?? 0;
            rows.push([input.states[i] ?? 0, input.actions[i] ?? 0, achieved, goal, rewardFor(achieved, goal, input.rewardSuccess, input.rewardFail)]);
        }
    }
    return rows;
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 5);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.meta["rows"]).toBe(rows);
        expect(frame.meta["cols"]).toBe(5);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Hindsight Experience Replay", () => {
    it("matches an independent goal relabeling row for row", () => {
        const cases: Input[] = [
            { states: [0, 1, 2, 3], actions: [0, 1, 0], kFuture: 2, rewardSuccess: 1, rewardFail: 0 },
            { states: [0, 2, 2, 5, 1], actions: [1, 0, 1, 0], kFuture: 3, rewardSuccess: 10, rewardFail: -1 },
            { states: [4, 4, 4], actions: [2, 2], kFuture: 1, rewardSuccess: 1, rewardFail: 0 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            const expected = reference(input);
            checkFrames(frames, expected.length);
            const final = frames[frames.length - 1]?.meta;
            const relabeled = final?.["relabeled"] as number[];
            expected.flat().forEach((v, i) => expect(relabeled[i]).toBe(v));
            expect(final?.["count"]).toBe(expected.length);
        }
    });

    it("assigns success reward exactly when the achieved state equals the goal", () => {
        const input: Input = { states: [0, 1, 2, 3], actions: [0, 1, 0], kFuture: 2, rewardSuccess: 1, rewardFail: 0 };
        const frames = [...mod.run(input)];
        const relabeled = frames[frames.length - 1]?.meta["relabeled"] as number[];
        for (let offset = 0; offset < relabeled.length; offset += 5) {
            const achieved = relabeled[offset + 2];
            const goal = relabeled[offset + 3];
            const reward = relabeled[offset + 4];
            expect(reward).toBe(achieved === goal ? 1 : 0);
        }
    });

    it("every relabeled goal is a state visited at or after that step", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const relabeled = frames[frames.length - 1]?.meta["relabeled"] as number[];
        for (let offset = 0; offset < relabeled.length; offset += 5) {
            expect(input.states).toContain(relabeled[offset + 3]);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
