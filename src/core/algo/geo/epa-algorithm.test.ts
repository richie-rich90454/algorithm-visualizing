/** epa-algorithm.test.ts - Brute-force Minkowski penetration cross-check, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./epa-algorithm";
import type { VisualFrame } from "@/types";

type Pt = [number, number];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const cross = (a: Pt, b: Pt): number => a[0] * b[1] - a[1] * b[0];
const dot = (a: Pt, b: Pt): number => a[0] * b[0] + a[1] * b[1];

function hull(points: Pt[]): Pt[] {
    const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (sorted.length <= 2) return sorted;
    const build = (list: Pt[]): Pt[] => {
        const out: Pt[] = [];
        for (const p of list) {
            while (out.length >= 2 && cross(sub(out[out.length - 1] as Pt, out[out.length - 2] as Pt), sub(p, out[out.length - 2] as Pt)) <= 0) out.pop();
            out.push(p);
        }
        out.pop();
        return out;
    };
    return build(sorted).concat(build(sorted.slice().reverse()));
}

/** Independent penetration depth: closest boundary of the full Minkowski hull. */
function brutePenetration(A: Pt[], B: Pt[]): number {
    const points: Pt[] = [];
    for (const a of A) for (const b of B) points.push(sub(a, b));
    const polygon = hull(points);
    let best = Infinity;
    for (let i = 0; i < polygon.length; i += 1) {
        const a = polygon[i] as Pt;
        const b = polygon[(i + 1) % polygon.length] as Pt;
        const edge = sub(b, a);
        const length = Math.hypot(edge[0], edge[1]);
        if (length < 1e-12) continue;
        const normal: Pt = [edge[1] / length, -edge[0] / length];
        best = Math.min(best, dot(a, normal));
    }
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(frame.edges.every((e) => ids.has(e.sourceId) && ids.has(e.targetId))).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["penetration"]).toBeDefined();
    });
}

describe("Expanding Polytope Algorithm", () => {
    it("matches brute-force penetration depth on overlapping polygons", () => {
        const cases: Array<{ A: Pt[]; B: Pt[] }> = [
            { A: [[0, 0], [4, 0], [4, 3], [0, 3]], B: [[3, 1], [6, 1], [6, 4], [3, 4]] },
            { A: [[0, 0], [5, 0], [5, 5], [0, 5]], B: [[2, 2], [7, 2], [7, 7], [2, 7]] },
            { A: [[0, 0], [4, 0], [2, 4]], B: [[1, 1], [5, 1], [3, 5]] },
            { A: [[0, 0], [6, 0], [6, 2], [0, 2]], B: [[1, -2], [3, -2], [3, 5], [1, 5]] },
        ];
        for (let caseIndex = 0; caseIndex < cases.length; caseIndex += 1) {
            const testCase = cases[caseIndex] as { A: Pt[]; B: Pt[] };
            const frames = [...mod.run({ polygonA: testCase.A, polygonB: testCase.B })];
            checkFrames(frames);
            const depth = Number(frames[frames.length - 1]?.meta["penetration"]);
            expect(Number.isFinite(depth)).toBe(true);
            expect(depth, `case ${caseIndex}`).toBeCloseTo(brutePenetration(testCase.A, testCase.B), 5);
        }
    });

    it("reports the hand-worked one-unit overlap", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(Number(frames[frames.length - 1]?.meta["penetration"])).toBeCloseTo(1, 5);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
