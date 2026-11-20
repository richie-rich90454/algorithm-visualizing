/**
 * confluent-persistent-queue.test.ts - Snapshot and meld correctness, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./confluent-persistent-queue";
import type { VisualFrame } from "@/types";

type Operation = { op: string; value?: number; version?: number; other?: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Confluent Persistent Queue", () => {
    it("reproduces an independent branching-and-meld model", () => {
        let seed = 31337;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % 10;
        };
        for (let trial = 0; trial < 20; trial += 1) {
            const ops: Operation[] = [];
            const count = 1 + (trial % 8);
            for (let i = 0; i < count; i += 1) {
                const v = rand() % (i + 1);
                const kind = rand() % 3;
                if (kind === 0) ops.push({ op: "enqueue", value: rand(), version: v });
                else if (kind === 1) ops.push({ op: "dequeue", version: v });
                else ops.push({ op: "meld", version: v, other: rand() % (i + 1) });
            }
            const versions: number[][] = [[]];
            for (const operation of ops) {
                const copy = [...(versions[operation.version ?? versions.length - 1] ?? [])];
                if (operation.op === "enqueue") copy.push(operation.value ?? 0);
                else if (operation.op === "dequeue" && copy.length > 0) copy.shift();
                else if (operation.op === "meld") copy.push(...(versions[operation.other ?? 0] ?? []));
                versions.push(copy);
            }
            const frames = [...mod.run({ ops })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["versions"]).toEqual(versions);
        }
    });

    it("melds chosen branches without mutating the sources", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const versions = frames[frames.length - 1]?.meta["versions"] as number[][];
        expect(versions[1]).toEqual([1]);
        expect(versions[2]).toEqual([1, 2]);
        expect(versions[3]).toEqual([3]);
        expect(versions[4]).toEqual([1, 3]);
        expect(versions[5]).toEqual([]);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
