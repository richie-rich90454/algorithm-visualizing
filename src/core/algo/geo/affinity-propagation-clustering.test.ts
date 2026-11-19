/** affinity-propagation-clustering.test.ts - Reference message passing, properties, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./affinity-propagation-clustering";

type Pt = [number, number];

function buildS(points: Pt[], preference?: number): number[][] {
    const S = points.map((p, i) =>
        points.map((q, j) =>
            i === j ? Number.NEGATIVE_INFINITY : -((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2),
        ),
    );
    const off: number[] = [];
    for (let i = 0; i < points.length; i += 1) {
        for (let j = 0; j < points.length; j += 1) if (i !== j) off.push(S[i]![j]!);
    }
    off.sort((a, b) => a - b);
    const pref = preference ?? off[Math.floor(off.length / 2)]!;
    for (let i = 0; i < points.length; i += 1) S[i]![i] = pref;
    return S;
}

function reference(S: number[][], damping: number, maxIterations: number) {
    const n = S.length;
    let r = S.map(() => S[0]!.map(() => 0));
    let a = S.map(() => S[0]!.map(() => 0));
    for (let it = 0; it < maxIterations; it += 1) {
        const nr = S.map(() => S[0]!.map(() => 0));
        for (let i = 0; i < n; i += 1) {
            for (let k = 0; k < n; k += 1) {
                let best = -Infinity;
                for (let k2 = 0; k2 < n; k2 += 1) {
                    if (k2 !== k) best = Math.max(best, a[i]![k2]! + S[i]![k2]!);
                }
                nr[i]![k] = S[i]![k]! - best;
            }
        }
        const na = S.map(() => S[0]!.map(() => 0));
        for (let k = 0; k < n; k += 1) {
            let incoming = 0;
            for (let i2 = 0; i2 < n; i2 += 1) if (i2 !== k) incoming += Math.max(0, nr[i2]![k]!);
            for (let i = 0; i < n; i += 1) {
                let target = incoming;
                if (i !== k) {
                    let other = nr[k]![k]!;
                    for (let i2 = 0; i2 < n; i2 += 1) {
                        if (i2 !== i && i2 !== k) other += Math.max(0, nr[i2]![k]!);
                    }
                    target = Math.min(0, other);
                }
                na[i]![k] = damping * a[i]![k]! + (1 - damping) * target;
            }
        }
        r = nr;
        a = na;
    }
    const self = Array.from({ length: n }, (_, k) => r[k]![k]! + a[k]![k]!);
    let exemplars = Array.from({ length: n }, (_, k) => k).filter((k) => self[k]! > 0);
    if (exemplars.length === 0) exemplars = [0];
    const assignments = Array.from({ length: n }, (_, i) => {
        let bestK = exemplars[0]!;
        let bestScore = -Infinity;
        for (const k of exemplars) {
            const score = r[i]![k]! + a[i]![k]!;
            if (score > bestScore) {
                bestScore = score;
                bestK = k;
            }
        }
        return exemplars.includes(i) ? i : bestK;
    });
    return { exemplars, assignments, self };
}

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 200; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(200);
    return frames;
}

const POINTS: Pt[] = [
    [0, 0],
    [1, 0.2],
    [2, -0.1],
    [8, 8],
    [8.5, 7.7],
    [7.8, 8.3],
];

describe("Affinity Propagation Clustering", () => {
    it("matches an independent message-passing reference", () => {
        for (const points of [POINTS, [...POINTS, [9, 9] as Pt]]) {
            const input = { points, damping: 0.7, maxIterations: 80 };
            const frames = framesFor(input);
            const final = frames[frames.length - 1]!;
            const ref = reference(buildS(points), 0.7, 80);
            expect(final.meta.exemplars).toEqual(ref.exemplars);
            expect(final.meta.assignments).toEqual(ref.assignments);
        }
    });

    it("satisfies exemplar and assignment properties on the final frame", () => {
        const frames = framesFor({ points: POINTS, damping: 0.7, maxIterations: 80 });
        const final = frames[frames.length - 1]!;
        const exemplars = final.meta.exemplars as number[];
        const assignments = final.meta.assignments as number[];
        const selfScores = final.meta.selfScores as number[];
        const scores = final.meta.scores as number[];
        const E = exemplars.length;

        expect(exemplars.length).toBeGreaterThan(0);
        expect(exemplars.length).toBeLessThan(POINTS.length);
        for (let k = 0; k < POINTS.length; k += 1) {
            expect(selfScores[k]! > 0).toBe(exemplars.includes(k));
        }
        for (let i = 0; i < POINTS.length; i += 1) {
            expect(exemplars).toContain(assignments[i]);
            let bestK = -1;
            let bestScore = -Infinity;
            for (let j = 0; j < E; j += 1) {
                const s = scores[i * E + j]!;
                if (s > bestScore) {
                    bestScore = s;
                    bestK = j;
                }
            }
            expect(assignments[i]).toBe(exemplars[bestK]);
        }
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
});
