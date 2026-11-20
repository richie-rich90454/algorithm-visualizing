/** quickhull.test.ts - Brute-force hull comparison, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./quickhull";

type Pt = [number, number];

function cross(o: Pt, a: Pt, b: Pt): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Reference extreme vertices via monotone chain (drops collinear points). */
function referenceHull(points: Pt[]): Set<number> {
    if (points.length <= 1) {
        return new Set(points.map((_, i) => i));
    }
    const order = points.map((_, i) => i).sort((a, b) => points[a]![0] - points[b]![0] || points[a]![1] - points[b]![1]);
    const lower: number[] = [];
    const upper: number[] = [];
    for (const i of order) {
        while (lower.length >= 2 && cross(points[lower[lower.length - 2]!]!, points[lower[lower.length - 1]!]!, points[i]!) <= 0) {
            lower.pop();
        }
        lower.push(i);
    }
    for (const i of [...order].reverse()) {
        while (upper.length >= 2 && cross(points[upper[upper.length - 2]!]!, points[upper[upper.length - 1]!]!, points[i]!) <= 0) {
            upper.pop();
        }
        upper.push(i);
    }
    return new Set([...lower.slice(0, -1), ...upper.slice(0, -1)]);
}

function sameSet(a: number[], b: Set<number>): boolean {
    if (a.length !== b.size) return false;
    return a.every((x) => b.has(x));
}

/** Deterministic pseudo-random integer point sets. */
function makeSets(): Pt[][] {
    const sets: Pt[][] = [
        [[0, 0], [2, 0], [2, 2], [0, 2], [1, 1]],
        [[0, 0], [1, 0], [2, 0], [3, 0]],
        [[0, 0], [0, 1], [0, 2], [0, 3]],
        [[0, 0], [4, 0], [2, 4]],
        [[5, 5]],
        [],
    ];
    let seed = 12345;
    const next = (): number => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed % 13;
    };
    for (let t = 0; t < 30; t += 1) {
        const set: Pt[] = [];
        const used = new Set<string>();
        const count = 3 + (t % 8);
        for (let k = 0; k < count; k += 1) {
            const x = next();
            const y = next();
            const key = `${x},${y}`;
            if (!used.has(key)) {
                used.add(key);
                set.push([x, y]);
            }
        }
        if (set.length >= 3) sets.push(set);
    }
    return sets;
}

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 2000; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(2000);
    return frames;
}

describe("QuickHull", () => {
    it("matches a reference monotone-chain hull on many point sets", () => {
        for (const points of makeSets()) {
            const frames = framesFor({ points });
            const final = frames[frames.length - 1]!;
            const hull = final.meta.hull as number[];
            expect(sameSet(hull, referenceHull(points))).toBe(true);
            // Every point must lie on or inside the clockwise hull polygon.
            for (let e = 0; e < hull.length; e += 1) {
                const u = points[hull[e]!]!;
                const v = points[hull[(e + 1) % hull.length]!]!;
                for (const p of points) {
                    expect(cross(u, v, p)).toBeLessThanOrEqual(1e-9);
                }
            }
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(2);
        const ids = new Set((frames[0]!.entities).map((e) => e.id));
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(mod.pseudocode!.length);
            expect(frame.layout).toBe("point");
            expect(frame.entities.length).toBeGreaterThan(0);
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
        });
    });
});
