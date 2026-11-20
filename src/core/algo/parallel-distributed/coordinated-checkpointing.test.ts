/**
 * coordinated-checkpointing.test.ts - Independent cut-consistency check,
 * coordinated versus skewed property, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./coordinated-checkpointing";
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

/** Independent in-transit count from the round schedule. */
function independentInTransit(p: number, rounds: number, cut: number[]): number {
    let count = 0;
    for (let r = 1; r <= rounds; r += 1) {
        for (let i = 0; i < p; i += 1) {
            const to = (i + 1) % p;
            if (r <= cut[i] && r > cut[to]) count += 1;
        }
    }
    return count;
}

describe("Coordinated Checkpointing", () => {
    it("finds zero in-transit messages for the coordinated cut", () => {
        const input = mod.defaultInput as { processes: number; rounds: number; checkpointRound: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.processes);
        const coord = frames[frames.length - 3]!.meta;
        const cut = coord["cut"] as number[];
        expect(coord["inTransit"]).toBe(0);
        expect(coord["consistent"]).toBe(true);
        expect(independentInTransit(input.processes, input.rounds, cut)).toBe(0);
    });

    it("detects in-transit messages in the skewed cut", () => {
        const input = mod.defaultInput as { processes: number; rounds: number; checkpointRound: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.processes);
        const skewed = frames[frames.length - 2]!.meta;
        const cut = skewed["cut"] as number[];
        expect(Number(skewed["inTransit"])).toBeGreaterThan(0);
        expect(skewed["consistent"]).toBe(false);
        expect(independentInTransit(input.processes, input.rounds, cut)).toBe(Number(skewed["inTransit"]));
    });

    it("agrees with an independent scan at several checkpoint rounds", () => {
        for (const ckpt of [1, 2, 3]) {
            const frames = [...mod.run({ processes: 5, rounds: 3, checkpointRound: ckpt })] as VisualFrame[];
            checkFrames(frames, 5);
            const skewedCut = [ckpt, ckpt - 1, ckpt - 1, ckpt - 1, ckpt - 1];
            expect(Number(frames[frames.length - 2]!.meta["inTransit"])).toBe(independentInTransit(5, 3, skewedCut));
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
