/**
 * bully-leader-election.test.ts - Coordinator brute force, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bully-leader-election";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], ids: number[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(ids.length);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(ids.length);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
    const labels = frames[0]?.entities.map((e) => e.label);
    expect(labels).toEqual(ids.map(String));
}

describe("BullyLeaderElection", () => {
    it("elects the highest alive identifier in many configurations", () => {
        const cases: Array<{ down: number[]; initiator: number }> = [
            { down: [], initiator: 0 },
            { down: [2], initiator: 1 },
            { down: [4], initiator: 3 },
            { down: [0, 1, 3], initiator: 0 },
            { down: [0, 1, 2, 3, 4], initiator: 2 },
            { down: [1, 2], initiator: 4 },
        ];
        const ids = [0, 1, 2, 3, 4];
        for (const testCase of cases) {
            const frames = [...mod.run({ processIds: ids, ...testCase })];
            checkFrames(frames, ids);
            const alive = ids.filter((id) => !testCase.down.includes(id));
            const expected = alive.length > 0 ? Math.max(...alive) : -1;
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["coordinator"]).toBe(expected);
            if (expected !== -1) {
                const winner = frames[frames.length - 1]?.entities.find((e) => e.value === expected);
                expect(winner?.state).toBe("sorted");
            }
        }
    });

    it("only counts replies from higher alive processes", () => {
        const ids = [0, 1, 2, 3, 4];
        const frames = [...mod.run({ processIds: ids, down: [2], initiator: 1 })];
        const expectedReplies = ids.filter((id) => id > 1 && id !== 2).length;
        const finalMeta = frames[frames.length - 1]?.meta;
        // One reply frame per higher alive process plus one final broadcast.
        expect(Number(finalMeta?.["messages"])).toBe(expectedReplies + 1);
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
