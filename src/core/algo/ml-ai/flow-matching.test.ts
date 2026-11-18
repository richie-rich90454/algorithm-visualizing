/** flow-matching.test.ts - Straight-line paths, Euler integration, frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./flow-matching";
import type { VisualFrame } from "@/types";

type Point = [number, number];
interface Input {
    sources: Point[];
    targets: Point[];
    steps: number;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Flow Matching", () => {
    it("each Euler frame matches the closed-form straight-line path", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.sources.length);
        for (const frame of frames) {
            const t = frame.meta["t"] as number;
            const positions = frame.meta["positions"] as number[];
            input.sources.forEach((source, i) => {
                const target = input.targets[i] as Point;
                expect(positions[i * 2]).toBeCloseTo(source[0] + t * (target[0] - source[0]), 9);
                expect(positions[i * 2 + 1]).toBeCloseTo(source[1] + t * (target[1] - source[1]), 9);
            });
        }
        const last = frames[frames.length - 1];
        expect(last?.meta["positions"]).toEqual(input.targets.reduce<number[]>((a, p) => a.concat(p), []));
    });

    it("the final frame lands exactly on every target for varied steps", () => {
        for (const steps of [1, 2, 3, 7]) {
            const input = { ...(mod.defaultInput as Input), steps };
            const frames = [...mod.run(input)];
            checkFrames(frames, input.sources.length);
            const positions = frames[frames.length - 1]?.meta["positions"] as number[];
            input.targets.forEach((target, i) => {
                expect(positions[i * 2]).toBeCloseTo(target[0], 9);
                expect(positions[i * 2 + 1]).toBeCloseTo(target[1], 9);
            });
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
