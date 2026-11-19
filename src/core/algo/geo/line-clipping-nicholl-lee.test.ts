/** line-clipping-nicholl-lee.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./line-clipping-nicholl-lee";
import type { VisualFrame } from "@/types";

type Pt = [number, number];
type Window = { xmin: number; ymin: number; xmax: number; ymax: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent Liang-Barsky reference clip. */
function reference(p0: Pt, p1: Pt, w: Window): { accepted: boolean; points: Pt[] } {
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const ps = [-dx, dx, -dy, dy];
    const qs = [p0[0] - w.xmin, w.xmax - p0[0], p0[1] - w.ymin, w.ymax - p0[1]];
    let t0 = 0;
    let t1 = 1;
    for (let i = 0; i < 4; i += 1) {
        const p = ps[i]!;
        const q = qs[i]!;
        if (p === 0 && q < 0) return { accepted: false, points: [] };
        if (p !== 0) {
            const r = q / p;
            if (p < 0) t0 = Math.max(t0, r);
            if (p > 0) t1 = Math.min(t1, r);
        }
    }
    if (t0 > t1) return { accepted: false, points: [] };
    return {
        accepted: true,
        points: [
            [p0[0] + t0 * dx, p0[1] + t0 * dy],
            [p0[0] + t1 * dx, p0[1] + t1 * dy],
        ],
    };
}

describe("Nicholl-Lee-Nicholl Line Clipping", () => {
    it("matches the Liang-Barsky reference on varied segments", () => {
        const w: Window = { xmin: 0, ymin: 0, xmax: 10, ymax: 8 };
        const cases: Array<[Pt, Pt]> = [
            [[-2, 5], [12, 3]],
            [[2, 3], [7, 6]],
            [[-3, -3], [-1, -1]],
            [[5, -2], [5, 11]],
            [[-1, 9], [11, -1]],
            [[0, 4], [10, 4]],
            [[10, 8], [10, 0]],
        ];
        for (const [p0, p1] of cases) {
            const frames = [...mod.run({ p0, p1, window: w })];
            checkFrames(frames);
            const finalMeta = frames[frames.length - 1]?.meta;
            const expected = reference(p0, p1, w);
            expect(finalMeta?.["accepted"]).toBe(expected.accepted);
            if (expected.accepted) {
                const actual = [finalMeta?.["entry"] as Pt, finalMeta?.["exit"] as Pt];
                for (let i = 0; i < 2; i += 1) {
                    const matchesSome = expected.points.some((p) =>
                        Math.abs(p[0] - actual[i]![0]) < 1e-6 && Math.abs(p[1] - actual[i]![1]) < 1e-6);
                    expect(matchesSome).toBe(true);
                }
            }
        }
    });

    it("keeps a fully inside segment unchanged", () => {
        const frames = [...mod.run({ p0: [1, 1], p1: [4, 5] })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["accepted"]).toBe(true);
        expect(meta?.["entry"]).toEqual([1, 1]);
        expect(meta?.["exit"]).toEqual([4, 5]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
