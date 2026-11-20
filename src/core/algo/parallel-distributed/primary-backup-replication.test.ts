/**
 * primary-backup-replication.test.ts - Log-prefix consistency, failover convergence, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./primary-backup-replication";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"] ?? frame.meta["replicas"]).toBeDefined();
        for (const e of frame.entities) expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
        expect(frame.edges).toEqual([]);
    });
}

function isPrefix(log: number[], ops: number[]): boolean {
    return log.length <= ops.length && log.every((v, i) => v === ops[i]);
}

describe("PrimaryBackupReplication", () => {
    it("converges all replicas to the full operation log", () => {
        const cases = [
            mod.defaultInput,
            { operations: [1, 2, 3], backups: 1, failAt: 0 },
            { operations: [4, 5], backups: 3, failAt: 2 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const ops = (input as { operations: number[] }).operations;
            const final = frames.at(-1)!;
            const parse = (s: string): number[] => (s === "" ? [] : s.split(",").map(Number));
            for (const log of final.meta["logs"] as string[]) expect(parse(log)).toEqual(ops);
            expect(final.meta["consistent"]).toBe(true);
        }
    });

    it("never lets a live replica hold a value out of primary order", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const ops = (mod.defaultInput as { operations: number[] }).operations;
        for (const frame of frames) {
            const alive = frame.meta["alive"] as number[];
            const logs = frame.meta["logs"] as string[];
            logs.forEach((encoded, i) => {
                if (alive[i]) {
                    const log = encoded === "" ? [] : encoded.split(",").map(Number);
                    expect(isPrefix(log, ops)).toBe(true);
                }
            });
        }
    });

    it("promotes exactly one backup after a failure", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const promotions = frames.filter((f) => (f.meta["last"] as string).includes("promoted")).length;
        expect(promotions).toBe(1);
        const final = frames.at(-1)!;
        expect(final.meta["failed"]).toBe(false);
        expect((final.meta["alive"] as number[]).every((v) => v === 1)).toBe(true);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBeGreaterThan(3);
        expect(gen.next().done).toBe(true);
    });
});
