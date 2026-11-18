/**
 * zab-consensus.test.ts - Leader brute force, zxid order, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./zab-consensus";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], servers: number, proposals: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(servers);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(servers);
    });
}

/** Brute-force leader choice from (epoch, id) pairs. */
function expectedLeader(servers: Array<{ id: number; epoch: number }>): { id: number; epoch: number } {
    let best = servers[0] ?? { id: -1, epoch: 0 };
    for (const s of servers) {
        if (s.epoch > best.epoch || (s.epoch === best.epoch && s.id > best.id)) {
            best = s;
        }
    }
    return { id: best.id, epoch: best.epoch };
}

describe("Zab atomic broadcast (teaching simulation)", () => {
    it("elects the greatest epoch then id across configurations", () => {
        const configs: Array<Array<{ id: number; epoch: number }>> = [
            [{ id: 0, epoch: 1 }, { id: 1, epoch: 1 }, { id: 2, epoch: 1 }, { id: 3, epoch: 1 }],
            [{ id: 0, epoch: 2 }, { id: 4, epoch: 1 }, { id: 2, epoch: 3 }],
            [{ id: 7, epoch: 0 }, { id: 3, epoch: 0 }, { id: 1, epoch: 0 }],
            [{ id: 2, epoch: 5 }, { id: 9, epoch: 5 }, { id: 1, epoch: 4 }],
        ];
        for (const servers of configs) {
            const frames = [...mod.run({ servers, proposals: ["a", "b"] })];
            checkFrames(frames, servers.length, 2);
            const want = expectedLeader(servers);
            const meta = frames[1]?.meta;
            expect(meta?.["leader"]).toBe(want.id);
            expect(meta?.["epoch"]).toBe(want.epoch);
            const leaderCell = frames[1]?.entities.find((e) => e.value === want.id);
            expect(leaderCell?.state).toBe("sorted");
        }
    });

    it("assigns strictly increasing zxids and commits every proposal", () => {
        const proposals = ["p", "q", "r", "s"];
        const servers = [
            { id: 0, epoch: 2 },
            { id: 1, epoch: 2 },
            { id: 2, epoch: 2 },
        ];
        const frames = [...mod.run({ servers, proposals })];
        checkFrames(frames, servers.length, proposals.length);
        const last = frames[frames.length - 1]?.meta;
        const zxids = last?.["zxids"] as number[];
        expect(zxids).toHaveLength(proposals.length);
        for (let i = 1; i < zxids.length; i += 1) {
            expect(zxids[i] ?? 0).toBeGreaterThan(zxids[i - 1] ?? 0);
        }
        expect(zxids[0]).toBe(2001);
        expect(last?.["committed"]).toBe(proposals.length);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
