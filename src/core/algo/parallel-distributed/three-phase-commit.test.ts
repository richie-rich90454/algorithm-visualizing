/**
 * three-phase-commit.test.ts - Exhaustive decision, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./three-phase-commit";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], total: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(total + 1);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Three-Phase Commit", () => {
    it("agrees on commit only when every participant votes yes, for all vote vectors", () => {
        for (let size = 1; size <= 4; size += 1) {
            const combinations = 1 << size;
            for (let mask = 0; mask < combinations; mask += 1) {
                const votes: boolean[] = Array.from(
                    { length: size },
                    (_, index) => (mask & (1 << index)) !== 0,
                );
                const frames = [...mod.run({ votes })];
                checkFrames(frames, size);
                const finalMeta = frames[frames.length - 1]!.meta;
                const allYes = votes.every(Boolean);
                expect(finalMeta["decision"]).toBe(allYes ? "commit" : "abort");
                expect(finalMeta["committed"]).toBe(allYes);
                expect(finalMeta["yesVotes"]).toBe(votes.filter(Boolean).length);

                const participantCells = frames[frames.length - 1]!.entities.filter(
                    (entity) => entity.id.startsWith("participant-"),
                );
                expect(participantCells.length).toBe(size);
                for (const cell of participantCells) {
                    expect(cell.state).toBe(allYes ? "sorted" : "error");
                }

                const decisions = frames
                    .map((frame) => frame.meta["decision"])
                    .filter((decision) => decision === "commit" || decision === "abort");
                expect(new Set(decisions).size).toBeLessThanOrEqual(1);
            }
        }
    });

    it("runs all three phases on a unanimous vote", () => {
        const frames = [...mod.run({ votes: [true, true, true] })];
        const phases = frames.map((frame) => frame.meta["phase"]);
        expect(phases).toContain("canCommit");
        expect(phases).toContain("preCommit");
        expect(phases).toContain("doCommit");
        expect(phases).toContain("done");
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
