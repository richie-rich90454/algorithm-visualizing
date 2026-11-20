/**
 * token-ring-mutual-exclusion.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./token-ring-mutual-exclusion";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], processes: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(processes);
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(processes);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const inCS = Number(frame.meta["inCS"]);
        expect(inCS === -1 || (inCS >= 0 && inCS < processes)).toBe(true);
        for (const entity of frame.entities) {
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(Number.isFinite(entity.y)).toBe(true);
        }
    });
}

describe("Token-Ring Mutual Exclusion", () => {
    it("gives every process exactly one visit per tour in ring order", () => {
        const input = mod.defaultInput as { processes: number; rounds: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.processes);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["entries"]).toEqual(
            Array.from({ length: input.processes }, () => input.rounds),
        );

        const visitOrder = frames
            .filter((frame) => Number(frame.meta["inCS"]) >= 0)
            .map((frame) => Number(frame.meta["inCS"]));
        const expected = Array.from(
            { length: input.rounds * input.processes },
            (_, index) => index % input.processes,
        );
        expect(visitOrder).toEqual(expected);
    });

    it("keeps the token holder as the only process inside the section", () => {
        const frames = [...mod.run({ processes: 3, rounds: 2 })];
        for (const frame of frames) {
            const inCS = Number(frame.meta["inCS"]);
            const holder = Number(frame.meta["holder"]);
            if (inCS >= 0) {
                expect(inCS).toBe(holder);
            }
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
