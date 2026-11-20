/**
 * viewstamped-replication.test.ts - Agreement and safety checks for the
 * replicated log, plus frame-shape and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./viewstamped-replication";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], replicas: number): void {
    expect(frames.length).toBeGreaterThan(1);
    for (const [index, frame] of frames.entries()) {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(replicas);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["quorum"]).toBe(Math.floor(replicas / 2) + 1);
        expect(Array.isArray(frame.meta["logs"])).toBe(true);
    }
}

describe("Viewstamped Replication", () => {
    it("keeps identical logs on all live replicas after a primary crash", () => {
        const input = mod.defaultInput as { replicas: number; requests: string[]; crashSeq: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.replicas);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta["consistent"]).toBe(true);

        const liveLogs = (finalMeta["finalLogs"] as string[]).filter((l) => l !== "-");
        expect(liveLogs.length).toBe(input.replicas - 1);
        expect(new Set(liveLogs).size).toBe(1);

        const expected = input.requests.slice(0, input.crashSeq).join("");
        expect(liveLogs[0]).toBe(expected);
        for (const log of liveLogs) {
            expect(new Set(log.split("")).size).toBe(log.length);
        }
        expect(frames.some((f) => f.meta["phase"] === "view-change-start")).toBe(true);
        expect(frames.some((f) => f.meta["phase"] === "recovery")).toBe(true);
    });

    it("commits every request and never duplicates when no crash occurs", () => {
        const input = { replicas: 3, requests: ["A", "B", "C"], crashSeq: 0 };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.replicas);
        const finalMeta = frames[frames.length - 1]?.meta;
        const logs = finalMeta["finalLogs"] as string[];
        expect(logs.every((l) => l === "ABC")).toBe(true);
        expect(frames.some((f) => f.meta["phase"] === "view-change-start")).toBe(false);
    });

    it("scales the quorum with the replica count", () => {
        const frames = [...mod.run({ replicas: 5, requests: ["X"], crashSeq: 0 })];
        checkFrames(frames, 5);
        expect(frames[0]?.meta["quorum"]).toBe(3);
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
