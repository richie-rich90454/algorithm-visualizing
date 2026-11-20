/**
 * paxos-commit.test.ts - Reference decision, quorum property, frame shape,
 * and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./paxos-commit";
import type { VisualFrame } from "@/types";

/** Independent reference for the simplified single-decree commitment. */
function reference(canPrepare: boolean[], nodes: number, failed: number[]) {
    const quorum = Math.floor(nodes / 2) + 1;
    const available = nodes - failed.length;
    const decisions = canPrepare.map((value) => (available >= quorum && value ? 1 : 0));
    return { quorum, available, canDecide: available >= quorum, decisions, commit: decisions.every((d) => d === 1) };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Paxos Commit", () => {
    it("matches a reference implementation", () => {
        const input = mod.defaultInput as { participants: boolean[]; nodes: number; failed: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.participants.length);
        const expected = reference(input.participants, input.nodes, input.failed);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["quorum"]).toBe(expected.quorum);
        expect(final?.["available"]).toBe(expected.available);
        expect(final?.["canDecide"]).toBe(expected.canDecide);
        expect(final?.["decisions"]).toEqual(expected.decisions);
        expect(final?.["commit"]).toBe(expected.commit);
    });

    it("commits only when every manager can prepare and quorum holds", () => {
        const cases: Array<{ votes: boolean[]; nodes: number; failed: number[]; commit: boolean }> = [
            { votes: [true, true, true], nodes: 5, failed: [], commit: true },
            { votes: [true, false, true], nodes: 5, failed: [], commit: false },
            { votes: [true, true, true], nodes: 5, failed: [0, 1, 2], commit: false },
            { votes: [true, true], nodes: 1, failed: [], commit: true },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ participants: testCase.votes, nodes: testCase.nodes, failed: testCase.failed })];
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["commit"]).toBe(testCase.commit);
            const expected = reference(testCase.votes, testCase.nodes, testCase.failed);
            expect(final?.["decisions"]).toEqual(expected.decisions);
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
