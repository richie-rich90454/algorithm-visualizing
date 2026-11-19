/** polygon-triangulation-dp.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./polygon-triangulation-dp";
import type { VisualFrame } from "@/types";

type Pt = [number, number];

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

/** Independent memoized enumeration of every triangulation. */
function bruteForce(points: Pt[]): number {
    const dist = (i: number, j: number): number => Math.hypot(points[i]![0] - points[j]![0], points[i]![1] - points[j]![1]);
    const memo = new Map<string, number>();
    const solve = (i: number, j: number): number => {
        if (j - i < 2) return 0;
        const key = `${i},${j}`;
        const cached = memo.get(key);
        if (cached !== undefined) return cached;
        let best = Infinity;
        for (let k = i + 1; k < j; k += 1) {
            const w = (a: number, b: number): number => (b === a + 1 ? 0 : dist(a, b));
            best = Math.min(best, solve(i, k) + solve(k, j) + w(i, k) + w(k, j));
        }
        memo.set(key, best);
        return best;
    };
    return solve(0, points.length - 1);
}

function orient(a: Pt, b: Pt, c: Pt): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

describe("Minimum Weight Polygon Triangulation", () => {
    it("matches brute-force enumeration on convex polygons", () => {
        const cases: Pt[][] = [
            [[0, 0], [5, 0], [7, 3], [4, 6], [0, 4]],
            [[0, 0], [4, 0], [6, 3], [3, 6], [-2, 3]],
            [[0, 0], [6, 0], [8, 4], [4, 7], [0, 4], [-2, 2]],
        ];
        for (const points of cases) {
            const frames = [...mod.run({ points })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(Number(meta?.["totalWeight"])).toBeCloseTo(bruteForce(points), 8);
        }
    });

    it("emits n-3 diagonals and n-2 triangles without crossings", () => {
        const points: Pt[] = [[0, 0], [5, 0], [7, 3], [4, 6], [0, 4], [-2, 2]];
        const frames = [...mod.run({ points })];
        const n = Number(frames[frames.length - 1]?.meta["n"]);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["diagonals"]).toBe(n - 3);
        expect(meta?.["triangles"]).toBe(n - 2);
        const edges = frames[frames.length - 1]!.edges;
        expect(edges.length).toBe(2 * n - 3);
        const diagonals = edges.filter((e) => e.state === "path");
        expect(diagonals.length).toBe(n - 3);
        const coords = new Map(frames[frames.length - 1]!.entities.map((e) => [e.id, e.value as Pt]));
        for (let i = 0; i < diagonals.length; i += 1) {
            for (let j = i + 1; j < diagonals.length; j += 1) {
                const a = diagonals[i]!;
                const b = diagonals[j]!;
                const shared = [a.sourceId, a.targetId].filter((id) => id === b.sourceId || id === b.targetId);
                if (shared.length > 0) continue;
                const p = coords.get(a.sourceId)!;
                const q = coords.get(a.targetId)!;
                const r = coords.get(b.sourceId)!;
                const s = coords.get(b.targetId)!;
                const o1 = orient(p, q, r);
                const o2 = orient(p, q, s);
                const o3 = orient(r, s, p);
                const o4 = orient(r, s, q);
                expect(o1 * o2 >= 0 || o3 * o4 >= 0).toBe(true);
            }
        }
    });

    it("guards a degenerate input", () => {
        const frames = [...mod.run({ points: [[0, 0], [1, 1]] })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["valid"]).toBe(false);
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
