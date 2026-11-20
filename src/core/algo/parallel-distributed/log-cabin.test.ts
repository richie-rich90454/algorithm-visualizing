/**
 * log-cabin.test.ts - Committed-prefix durability, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./log-cabin";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(Number(frame.meta["rows"]) * Number(frame.meta["cols"]));
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.every((e) => typeof e.metadata["row"] === "number" && typeof e.metadata["col"] === "number")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function logsOf(frame: VisualFrame): number[][] {
    return (frame.meta["logs"] as string[]).map((entry) => (entry === "" ? [] : entry.split(",").map(Number)));
}

describe("LogCabin Replication", () => {
    it("elects the longest-log replica and preserves the committed prefix", () => {
        const input = mod.defaultInput as object;
        const frames = [...mod.run(input)];
        checkFrames(frames);

        const elected = frames.find((frame) => frame.meta["phase"] === "elected");
        expect(elected).toBeDefined();
        const logsBefore = logsOf(elected!);
        const leader = Number(elected!.meta["leader"]);
        const leaderLength = logsBefore[leader]!.length;
        for (const log of logsBefore) expect(log.length).toBeLessThanOrEqual(leaderLength);
        const committed = Number(elected!.meta["committed"]);
        const quorum = Number(elected!.meta["quorum"]);
        let holders = 0;
        for (const log of logsBefore) {
            let holds = true;
            for (let index = 0; index < committed; index += 1) {
                if (log[index] !== index + 1) holds = false;
            }
            if (holds) holders += 1;
        }
        expect(holders).toBeGreaterThanOrEqual(quorum);
        for (let index = 0; index < committed; index += 1) {
            expect(logsBefore[leader]![index]).toBe(index + 1);
        }

        const final = frames[frames.length - 1]!;
        const finalLogs = logsOf(final);
        const entries = (input as { entries: number[] }).entries;
        for (const log of finalLogs) expect(log).toEqual(entries);
        expect(Number(final.meta["committed"])).toBe(entries.length);
    });

    it("never decreases the commit index", () => {
        const frames = [...mod.run({ replicas: 5, entries: [1, 2, 3, 4, 5, 6], failAfter: 2 })];
        let previous = -1;
        for (const frame of frames) {
            const current = Number(frame.meta["committed"]);
            expect(current).toBeGreaterThanOrEqual(previous);
            previous = current;
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
