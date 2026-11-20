/** birch-clustering.test.ts - CF-sum properties, nearest-centroid check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./birch-clustering";

type Pt = [number, number];

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 300; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(300);
    return frames;
}

describe("BIRCH Clustering", () => {
    it("keeps CF counts, sums and centroids consistent with assignments", () => {
        const points: Pt[] = [
            [0, 0],
            [0.2, 0.1],
            [0.1, -0.2],
            [5, 5],
            [5.2, 4.9],
            [4.9, 5.1],
        ];
        const frames = framesFor({ points, threshold: 0.6, branchingFactor: 3 });
        const final = frames[frames.length - 1]!;
        const N = final.meta.clusterN as number[];
        const CX = final.meta.clusterCX as number[];
        const CY = final.meta.clusterCY as number[];
        const SS = final.meta.clusterSS as number[];
        const assign = final.meta.assignments as number[];

        expect(N.reduce((a, b) => a + b, 0)).toBe(points.length);
        for (let k = 0; k < N.length; k += 1) {
            const members = points.filter((_, i) => assign[i] === k);
            expect(members.length).toBe(N[k]);
            const sx = members.reduce((s, p) => s + p[0], 0);
            const sy = members.reduce((s, p) => s + p[1], 0);
            expect(CX[k]!).toBeCloseTo(sx / members.length, 9);
            expect(CY[k]!).toBeCloseTo(sy / members.length, 9);
            expect(SS[k]!).toBeCloseTo(members.reduce((s, p) => s + p[0] ** 2 + p[1] ** 2, 0), 9);
        }
        for (let i = 0; i < points.length; i += 1) {
            let best = 0;
            let bestD = Infinity;
            for (let k = 0; k < N.length; k += 1) {
                const d = Math.hypot(points[i]![0] - CX[k]!, points[i]![1] - CY[k]!);
                if (d < bestD) {
                    bestD = d;
                    best = k;
                }
            }
            expect(assign[i]).toBe(best);
        }
    });

    it("separates two well-separated groups into two clusters", () => {
        const points: Pt[] = [
            [0, 0],
            [0.1, 0.2],
            [0.3, -0.1],
            [10, 10],
            [10.2, 9.9],
            [9.8, 10.1],
        ];
        const frames = framesFor({ points, threshold: 0.7, branchingFactor: 4 });
        const final = frames[frames.length - 1]!;
        expect((final.meta.subclusters as number)).toBe(2);
        const CX = final.meta.clusterCX as number[];
        const CY = final.meta.clusterCY as number[];
        const centroids = CX.map((x, k) => [x, CY[k]!] as Pt).sort((a, b) => a[0] - b[0]);
        expect(centroids[0]![0]).toBeCloseTo(0.13, 1);
        expect(centroids[0]![1]).toBeCloseTo(0.03, 1);
        expect(centroids[1]![0]).toBeCloseTo(10, 1);
        expect(centroids[1]![1]).toBeCloseTo(10, 1);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(mod.pseudocode!.length);
            expect(frame.layout).toBe("point");
            const ids = new Set(frame.entities.map((e) => e.id));
            for (const entity of frame.entities) {
                expect(Number.isFinite(entity.x)).toBe(true);
                expect(Number.isFinite(entity.y)).toBe(true);
            }
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
        });
    });

    it("handles an empty point set", () => {
        const frames = framesFor({ points: [] });
        expect(frames.length).toBe(1);
        expect(frames[0]!.description.length).toBeGreaterThanOrEqual(10);
    });
});
