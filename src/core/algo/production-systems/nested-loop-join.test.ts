/**
 * nested-loop-join.test.ts - Brute-force cross-product cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./nested-loop-join";
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
            expect(Number.isFinite(entity.value as number)).toBe(true);
            expect(entity.metadata["row"]).toBeDefined();
            expect(entity.metadata["col"]).toBeDefined();
        }
    });
}

function bruteForce(outer: Row[], inner: Row[]): string[] {
    const out: string[] = [];
    for (const o of outer) for (const p of inner) if (o.key === p.key) out.push(`${o.key},${o.value},${p.key},${p.value}`);
    return out.sort();
}

function matchesFrom(frames: VisualFrame[]): string[] {
    const flat = frames[frames.length - 1]!.meta["matches"] as number[];
    const out: string[] = [];
    for (let i = 0; i < flat.length; i += 4) out.push(`${flat[i]},${flat[i + 1]},${flat[i + 2]},${flat[i + 3]}`);
    return out.sort();
}

describe("NestedLoopJoin", () => {
    it("equals a brute-force cross-product join on the default input", () => {
        const input = mod.defaultInput as { outer: Row[]; inner: Row[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        expect(matchesFrom(frames)).toEqual(bruteForce(input.outer, input.inner));
        expect(frames[frames.length - 1]!.meta["comparisons"]).toBe(input.outer.length * input.inner.length);
    });

    it("works across random small inputs checked against brute force", () => {
        let seed = 12345;
        const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 97);
        for (let trial = 0; trial < 12; trial += 1) {
            const outer = Array.from({ length: 1 + (rnd() % 5) }, () => ({ key: rnd() % 6, value: rnd() }));
            const inner = Array.from({ length: 1 + (rnd() % 5) }, () => ({ key: rnd() % 6, value: rnd() }));
            const frames = [...mod.run({ outer, inner })];
            checkFrames(frames);
            expect(matchesFrom(frames)).toEqual(bruteForce(outer, inner));
        }
    });

    it("handles empty relations and no matches", () => {
        expect(matchesFrom([...mod.run({ outer: [], inner: [{ key: 1, value: 1 }] })])).toEqual([]);
        expect(matchesFrom([...mod.run({ outer: [{ key: 1, value: 1 }], inner: [] })])).toEqual([]);
        expect(matchesFrom([...mod.run({ outer: [{ key: 1, value: 1 }], inner: [{ key: 2, value: 2 }] })])).toEqual([]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
