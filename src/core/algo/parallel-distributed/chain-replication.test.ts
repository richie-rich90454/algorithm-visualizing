/**
 * chain-replication.test.ts - Commit and reconfiguration property checks.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateChainReplication } from "./chain-replication";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], servers: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(servers);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(frame.edges.length).toBe(servers - 1);
        expect(frame.edges.every((e) => e.directed && ids.has(e.sourceId) && ids.has(e.targetId))).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Chain Replication", () => {
    it("commits exactly the writes that reach the tail and bypasses a failed server", () => {
        const servers = ["H", "S1", "S2", "S3", "T"];
        const writes = [1, 2, 3, 4, 5];
        for (let failIndex = -1; failIndex < servers.length; failIndex += 1) {
            for (let failAfter = 0; failAfter <= writes.length; failAfter += 1) {
                const data = simulateChainReplication(servers, writes, failIndex, failAfter);
                const expectedCommitted = failIndex < 0 ? writes : writes.slice(0, failAfter);
                expect(data.committed).toEqual(expectedCommitted);
                const expectedChain = failIndex < 0 ? servers : servers.filter((_, i) => i !== failIndex);
                expect(data.newChain).toEqual(expectedChain);
                expect(data.traversed.length).toBe(writes.length);
                if (failIndex >= 0) {
                    for (let k = failAfter; k < writes.length; k += 1) {
                        const path = data.traversed[k] ?? [];
                        expect(path[path.length - 1]).toBe(failIndex);
                    }
                }
            }
        }
    });

    it("emits one write frame per write plus setup and done", () => {
        const input = { chain: ["H", "S1", "S2", "T"], writes: [5, 6, 7], failIndex: 1, failAfter: 1 };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.chain.length);
        expect(frames.length).toBe(2 + input.writes.length);
        expect(frames[frames.length - 1]?.meta["committedValues"]).toEqual([5]);
    });

    it("produces well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 4);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
