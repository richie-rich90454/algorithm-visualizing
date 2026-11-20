/**
 * sort-merge-join.test.ts - Nested-loop cross-check, sorted order, group cross product, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./sort-merge-join";
import type { VisualFrame } from "@/types";

interface Row { key: number; value: number }

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(entity.type).toBe("cell");
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(entity.metadata).toBeDefined();
        }
    });
}

function bruteForce(left: Row[], right: Row[]): string[] {
    const result: string[] = [];
    for (const l of left) {
        for (const r of right) {
            if (l.key === r.key) result.push(`${l.key},${l.value},${r.key},${r.value}`);
        }
    }
    return result.sort();
}

function matchesFrom(frames: VisualFrame[]): string[] {
    const flat = frames[frames.length - 1]?.meta["matches"] as number[];
    const result: string[] = [];
    for (let i = 0; i < flat.length; i += 4) {
        result.push(`${flat[i]},${flat[i + 1]},${flat[i + 2]},${flat[i + 3]}`);
    }
    return result.sort();
}

describe("SortMergeJoin", () => {
    it("matches a nested-loop join exactly on the default input", () => {
        const input = mod.defaultInput as { left: Row[]; right: Row[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        expect(matchesFrom(frames)).toEqual(bruteForce(input.left, input.right));
    });

    it("sorts both sides and emits the full group cross product", () => {
        const left = [{ key: 4, value: 1 }, { key: 2, value: 2 }, { key: 2, value: 3 }, { key: 9, value: 4 }];
        const right = [{ key: 2, value: 20 }, { key: 2, value: 21 }, { key: 4, value: 40 }];
        const frames = [...mod.run({ left, right })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const leftKeys = meta?.["leftKeys"] as number[];
        const rightKeys = meta?.["rightKeys"] as number[];
        for (let i = 1; i < leftKeys.length; i += 1) expect(leftKeys[i] as number).toBeGreaterThanOrEqual(leftKeys[i - 1] as number);
        for (let i = 1; i < rightKeys.length; i += 1) expect(rightKeys[i] as number).toBeGreaterThanOrEqual(rightKeys[i - 1] as number);
        expect(matchesFrom(frames)).toEqual(bruteForce(left, right));
        expect(matchesFrom(frames).length).toBe(5);
    });

    it("emits no matches for disjoint key sets", () => {
        const frames = [...mod.run({ left: [{ key: 1, value: 1 }], right: [{ key: 2, value: 2 }] })];
        checkFrames(frames);
        expect(matchesFrom(frames)).toEqual([]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(3);
        expect(generator.next().done).toBe(true);
    });
});
