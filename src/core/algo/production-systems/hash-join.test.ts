/**
 * hash-join.test.ts - Nested-loop cross-check, partition preservation, skew handling, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./hash-join";
import type { VisualFrame } from "@/types";

interface Row { key: number; value: number }

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(entity.type).toBe("bar");
            expect(Number.isFinite(entity.value as number)).toBe(true);
            expect(entity.metadata).toBeDefined();
        }
    });
}

function bruteForce(build: Row[], probe: Row[]): string[] {
    const matches: string[] = [];
    for (const b of build) {
        for (const p of probe) {
            if (b.key === p.key) matches.push(`${b.key},${b.value},${p.key},${p.value}`);
        }
    }
    return matches.sort();
}

function matchesFrom(frames: VisualFrame[]): string[] {
    const flat = frames[frames.length - 1]?.meta["matches"] as number[];
    const result: string[] = [];
    for (let i = 0; i < flat.length; i += 4) {
        result.push(`${flat[i]},${flat[i + 1]},${flat[i + 2]},${flat[i + 3]}`);
    }
    return result.sort();
}

describe("HashJoin", () => {
    it("matches a nested-loop join exactly on the default input", () => {
        const input = mod.defaultInput as { build: Row[]; probe: Row[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        expect(matchesFrom(frames)).toEqual(bruteForce(input.build, input.probe));
    });

    it("emits only equal-key pairs and preserves all partitioned rows", () => {
        const build = [{ key: 1, value: 7 }, { key: 5, value: 8 }, { key: 5, value: 9 }];
        const probe = [{ key: 5, value: 50 }, { key: 2, value: 20 }];
        const frames = [...mod.run({ build, probe, partitions: 4, capacity: 2 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const flat = meta?.["matches"] as number[];
        for (let i = 0; i < flat.length; i += 4) {
            expect(flat[i]).toBe(flat[i + 2]);
        }
        expect((meta?.["bucketBuild"] as number[]).reduce((a, b) => a + b, 0)).toBe(build.length);
        expect((meta?.["bucketProbe"] as number[]).reduce((a, b) => a + b, 0)).toBe(probe.length);
        expect(matchesFrom(frames)).toEqual(bruteForce(build, probe));
    });

    it("handles a heavily skewed bucket through recursive repartitioning", () => {
        const build = Array.from({ length: 8 }, (_unused, index) => ({ key: 1, value: index }));
        const probe = [{ key: 1, value: 100 }, { key: 1, value: 101 }];
        const frames = [...mod.run({ build, probe, partitions: 2, capacity: 2 })];
        checkFrames(frames);
        expect(matchesFrom(frames)).toEqual(bruteForce(build, probe));
        expect(matchesFrom(frames).length).toBe(16);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
