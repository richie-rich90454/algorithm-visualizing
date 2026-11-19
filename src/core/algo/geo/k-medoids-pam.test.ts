/** k-medoids-pam.test.ts - Exhaustive medoid-subset optimum and consistency checks. */

import { describe, expect, it } from "vitest";
import mod from "./k-medoids-pam";

type Pt = [number, number];

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 500; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(500);
    return frames;
}

function cost(points: Pt[], medoids: number[]): number {
    let total = 0;
    for (const p of points) {
        let best = Infinity;
        for (const m of medoids) {
            best = Math.min(best, Math.abs(p[0] - points[m]![0]) + Math.abs(p[1] - points[m]![1]));
        }
        total += best;
    }
    return total;
}

/** Enumerate every k-subset to find the true global optimum. */
function bruteForce(points: Pt[], k: number): number {
    let best = Infinity;
    const n = points.length;
    const choose = (start: number, picked: number[]): void => {
        if (picked.length === k) {
            best = Math.min(best, cost(points, picked));
            return;
        }
        for (let i = start; i <= n - (k - picked.length); i += 1) choose(i + 1, [...picked, i]);
    };
    choose(0, []);
    return best;
}

const CASES: Array<{ points: Pt[]; k: number }> = [
    { points: [[0, 0], [1, 0], [2, 0], [8, 8], [9, 8], [8, 9], [9, 9], [1, 1]], k: 2 },
    { points: [[0, 0], [1, 0], [6, 6], [7, 6], [3, 3]], k: 2 },
    { points: [[0, 0], [2, 0], [0, 2], [2, 2], [1, 1], [9, 9]], k: 3 },
    { points: [[5, 5], [0, 0], [10, 0], [0, 10]], k: 1 },
];

describe("K-Medoids PAM Clustering", () => {
    it("finds the globally optimal medoid cost on small sets", () => {
        for (const input of CASES) {
            const frames = framesFor(input);
            const final = frames[frames.length - 1]!;
            const medoids = final.meta.medoids as number[];
            expect(medoids.length).toBe(input.k);
            expect(new Set(medoids).size).toBe(input.k);
            expect(final.meta.cost).toBe(cost(input.points, medoids));
            expect(final.meta.cost).toBe(bruteForce(input.points, input.k));
        }
    });

    it("assigns each point to its nearest medoid", () => {
        for (const input of CASES) {
            const frames = framesFor(input);
            const final = frames[frames.length - 1]!;
            const medoids = final.meta.medoids as number[];
            const assignment = final.meta.assignments as number[];
            expect(assignment.length).toBe(input.points.length);
            input.points.forEach((p, i) => {
                let nearest = medoids[0]!;
                let best = Infinity;
                for (const m of medoids) {
                    const d = Math.abs(p[0] - input.points[m]![0]) + Math.abs(p[1] - input.points[m]![1]);
                    if (d < best) {
                        best = d;
                        nearest = m;
                    }
                }
                expect(assignment[i]!).toBe(nearest);
            });
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber!).toBeGreaterThanOrEqual(0);
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
});
