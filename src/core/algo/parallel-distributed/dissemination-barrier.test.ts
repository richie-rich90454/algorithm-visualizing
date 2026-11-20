/**
 * dissemination-barrier.test.ts - Round-count and release-timing property
 * checks, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./dissemination-barrier";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], p: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(p);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Dissemination Barrier", () => {
    it("uses log2(p) rounds and one release per epoch", () => {
        const p = 8;
        const epochs = 3;
        const frames = [...mod.run({ processes: p, epochs })];
        checkFrames(frames, p);
        const roundFrames = frames.filter((f) => f.description.includes("round "));
        expect(roundFrames.length).toBe(epochs * 3);
        const releases = frames.filter((f) => f.description.includes("leave the barrier"));
        expect(releases.length).toBe(epochs);
        const last = frames[frames.length - 1]!.meta;
        expect(last["releases"]).toBe(epochs);
        expect(last["rounds"]).toBe(3);
    });

    it("sends exactly p notifications in every round", () => {
        const frames = [...mod.run({ processes: 4, epochs: 1 })];
        checkFrames(frames, 4);
        for (const frame of frames) {
            if (frame.meta["round"] !== undefined && frame.meta["offset"] !== undefined) {
                expect(Number(frame.meta["sends"])).toBe(4);
                expect(Number(frame.meta["offset"])).toBe(2 ** (Number(frame.meta["round"]) - 1));
                const completed = frame.meta["completed"] as number[];
                expect(completed.every((v) => v === Number(frame.meta["round"]))).toBe(true);
            }
        }
    });

    it("never releases a process before the final round", () => {
        const frames = [...mod.run({ processes: 4, epochs: 2 })];
        checkFrames(frames, 4);
        for (const frame of frames) {
            const released = frame.entities.every((e) => e.metadata["released"] === true);
            if (released) {
                expect(frame.meta["round"]).toBe(frame.meta["rounds"]);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
