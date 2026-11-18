/**
 * lsm-tree-compaction.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./lsm-tree-compaction";
import type { VisualFrame } from "@/types";

type Pair = [number, string];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("LSM Tree Compaction", () => {
    it("keeps the newest value for every key", () => {
        const runs: Pair[][] = [
            [[1, "a"], [3, "c"], [5, "e"]],
            [[2, "b"], [4, "d"], [6, "f"]],
            [[3, "C"], [5, "E"], [7, "g"]],
            [[1, "A"], [8, "h"], [9, "i"]],
            [[2, "B"], [4, "D"], [10, "j"]],
        ];
        const frames = [...mod.run({ runs, threshold: 2 })];
        checkFrames(frames);
        const reference = new Map<number, string>();
        for (const run of runs) {
            for (const [key, value] of run) reference.set(key, value);
        }
        const meta = frames[frames.length - 1]?.meta;
        const keys = meta?.["visibleKeys"] as number[];
        const values = meta?.["visibleValues"] as string[];
        expect(keys.length).toBe(reference.size);
        for (let i = 0; i < keys.length; i += 1) {
            expect(values[i]).toBe(reference.get(keys[i] as number));
            if (i > 0) expect(keys[i] as number).toBeGreaterThan(keys[i - 1] as number);
        }
    });

    it("compacts at the configured threshold", () => {
        const runs: Pair[][] = [
            [[1, "a"]],
            [[2, "b"]],
            [[3, "c"]],
            [[4, "d"]],
            [[5, "e"]],
            [[6, "f"]],
        ];
        for (const threshold of [2, 3, 4]) {
            const frames = [...mod.run({ runs, threshold })];
            checkFrames(frames);
            const compactions = frames[frames.length - 1]?.meta["compactions"] as number;
            expect(compactions).toBe(Math.floor(runs.length / threshold));
        }
    });

    it("handles overwrite-heavy runs", () => {
        const runs: Pair[][] = [
            [[1, "v1"], [2, "v1"]],
            [[1, "v2"], [2, "v2"]],
            [[1, "v3"]],
        ];
        const frames = [...mod.run({ runs, threshold: 2 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["visibleKeys"]).toEqual([1, 2]);
        expect(meta?.["visibleValues"]).toEqual(["v3", "v2"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
