/** minkowski-sum.test.ts - Brute-force sum verification, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./minkowski-sum";

type Pt = [number, number];

function cross(o: Pt, a: Pt, b: Pt): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Extreme vertices (by coordinate key) of a point set via monotone chain. */
function extremeKeys(points: Pt[]): Set<string> {
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
    return new Set([...lower.slice(0, -1), ...upper.slice(0, -1)].map((i) => `${points[i]![0]},${points[i]![1]}`));
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

function checkCase(a: Pt[], b: Pt[]): void {
    const frames = framesFor({ a, b });
    const final = frames[frames.length - 1]!;
    const sumFlat = final.meta.sum as number[];
    const sum: Pt[] = [];
    for (let i = 0; i < sumFlat.length; i += 2) {
        sum.push([sumFlat[i]!, sumFlat[i + 1]!]);
    }

    // Brute force: convex hull of every pairwise sum a + b.
    const all: Pt[] = [];
    for (const p of a) for (const q of b) all.push([p[0] + q[0], p[1] + q[1]]);
    const expected = extremeKeys(all);
    const actual = extremeKeys(sum);
    expect(actual.size).toBe(expected.size);
    expect([...actual].every((key) => expected.has(key))).toBe(true);

    // Every pairwise sum lies inside the computed sum polygon.
    for (let e = 0; e < sum.length; e += 1) {
        const u = sum[e]!;
        const v = sum[(e + 1) % sum.length]!;
        for (const p of all) {
            expect(cross(u, v, p)).toBeGreaterThanOrEqual(-1e-9);
        }
    }
}

describe("Minkowski Sum", () => {
    it("matches the convex hull of all pairwise sums", () => {
        checkCase(
            [[0, 0], [2, 0], [2, 2], [0, 2]],
            [[0, 0], [1, 0], [1, 1], [0, 1]],
        );
        checkCase(
            [[0, 0], [3, 0], [0, 3]],
            [[0, 0], [2, 0], [2, 1], [0, 1]],
        );
        checkCase(
            [[0, 0], [4, 0], [4, 2], [0, 2]],
            [[0, 0], [1, 0], [3, 2], [0, 3]],
        );
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(mod.pseudocode!.length);
            expect(frame.layout).toBe("point");
            expect(frame.entities.length).toBeGreaterThan(0);
            const ids = new Set(frame.entities.map((e) => e.id));
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
        });
    });

    it("handles an empty operand", () => {
        const frames = framesFor({ a: [], b: [[0, 0], [1, 0], [0, 1]] });
        expect(frames.length).toBeGreaterThan(0);
        expect(frames[frames.length - 1]!.meta.sum).toEqual([]);
    });
});
