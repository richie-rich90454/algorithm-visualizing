/**
 * byzantine-paxos.test.ts - Byzantine agreement correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./byzantine-paxos";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Byzantine Paxos (Teaching Core)", () => {
    it("satisfies agreement and validity with one faulty process", () => {
        const frames = [...mod.run({ processes: 4, faults: 1, leaderValue: 7, byzantineValue: 3 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["agreement"]).toBe(true);
        expect(final?.["validity"]).toBe(true);
        const decisions = final?.["decisions"] as number[];
        expect(decisions.length).toBe(3);
        decisions.forEach((d) => expect(d).toBe(7));
    });

    it("tolerates the maximum fault bound for several sizes", () => {
        const cases = [
            { processes: 4, faults: 1 },
            { processes: 7, faults: 2 },
            { processes: 10, faults: 3 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ ...testCase, leaderValue: 5, byzantineValue: 9 })];
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["agreement"]).toBe(true);
            expect(final?.["validity"]).toBe(true);
            expect(Number(final?.["quorum"])).toBe(testCase.processes - testCase.faults);
        }
    });

    it("brute-force checks each acceptor's vote tally reaches quorum", () => {
        const frames = [...mod.run({ processes: 7, faults: 2, leaderValue: 5, byzantineValue: 9 })];
        const tallyFrames = frames.filter((f) => f.meta["votes"] !== undefined);
        expect(tallyFrames.length).toBe(5);
        for (const frame of tallyFrames) {
            const votes = frame.meta["votes"] as Record<string, number>;
            expect(votes["5"]).toBe(5);
            expect(votes["9"]).toBe(2);
            expect(frame.meta["decision"]).toBe(5);
        }
    });

    it("rejects an impossible fault ratio", () => {
        const frames = [...mod.run({ processes: 3, faults: 2 })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["valid"]).toBe(false);
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
