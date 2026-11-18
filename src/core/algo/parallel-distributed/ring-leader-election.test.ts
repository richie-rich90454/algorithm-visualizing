/**
 * ring-leader-election.test.ts - Independent token simulation, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./ring-leader-election";
import type { VisualFrame } from "@/types";

function reference(ids: number[], down: number[], initiator: number) {
    const downSet = new Set(down);
    const ring = ids.filter((id) => !downSet.has(id));
    if (ring.length === 0 || !ring.includes(initiator)) return { leader: -1, tokens: [] as number[] };
    const start = ring.indexOf(initiator);
    let token = initiator;
    const tokens: number[] = [];
    for (let k = 0; k < ring.length; k += 1) {
        token = Math.max(token, ring[(start + k) % ring.length]!);
        tokens.push(token);
    }
    return { leader: token, tokens };
}

function checkFrames(frames: VisualFrame[], ids: number[], ringSize: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(ids.length);
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        const expectedEdges = ringSize >= 2 ? ringSize : 0;
        expect(frame.edges.length).toBe(expectedEdges);
        const idsInFrame = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(idsInFrame.has(edge.sourceId)).toBe(true);
            expect(idsInFrame.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("RingLeaderElection", () => {
    it("elects the maximum alive id regardless of the initiator", () => {
        const ids = [10, 4, 7, 2, 9, 5];
        const down = [2];
        for (const initiator of ids.filter((id) => !down.includes(id))) {
            const frames = [...mod.run({ processIds: ids, down, initiator })];
            checkFrames(frames, ids, ids.length - down.length);
            const expected = reference(ids, down, initiator);
            const final = frames[frames.length - 1];
            expect(final?.meta["leader"]).toBe(expected.leader);
            expect(final?.meta["leader"]).toBe(10);
            expect(final?.meta["announced"]).toBe(true);
            const tokenFrames = frames.filter((frame) => frame.meta["visits"] !== undefined);
            expect(tokenFrames.map((frame) => frame.meta["token"])).toEqual(expected.tokens);
        }
    });

    it("handles no alive processes, all alive, and a down initiator", () => {
        const cases: Array<{ ids: number[]; down: number[]; initiator: number }> = [
            { ids: [0, 1, 2], down: [0, 1, 2], initiator: 0 },
            { ids: [3, 1, 2], down: [], initiator: 1 },
            { ids: [0, 1, 2], down: [1], initiator: 1 },
            { ids: [5], down: [], initiator: 5 },
        ];
        for (const { ids, down, initiator } of cases) {
            const frames = [...mod.run({ processIds: ids, down, initiator })];
            checkFrames(frames, ids, ids.filter((id) => !down.includes(id)).length);
            const expected = reference(ids, down, initiator);
            expect(frames[frames.length - 1]?.meta["leader"]).toBe(expected.leader);
        }
    });

    it("marks failed processes red in every frame", () => {
        const frames = [...mod.run({ processIds: [0, 1, 2, 3], down: [1], initiator: 0 })];
        for (const frame of frames) {
            const failed = frame.entities.filter((entity) => entity.metadata["failed"] === true);
            expect(failed.length).toBe(1);
            expect(failed[0]?.state).toBe("error");
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
