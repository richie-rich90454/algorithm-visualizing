import { describe, expect, it } from "vitest";
import multidimensionalDelaunay from "./multidimensional-delaunay";

type Vec = number[];
type Simplex = number[];

/** Independent reference: solve a small linear system by Cramer-style elimination. */
function solve(rows: number[][], rhs: number[]): Vec | null {
    const n = rhs.length;
    const a = rows.map((row, i) => [...row, rhs[i] as number]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(a[r]?.[col] ?? 0) > Math.abs(a[pivot]?.[col] ?? 0)) pivot = r;
        }
        if (Math.abs(a[pivot]?.[col] ?? 0) < 1e-12) return null;
        const t = a[col] as number[];
        a[col] = a[pivot] as number[];
        a[pivot] = t;
        const p = a[col][col] as number;
        for (let c = col; c <= n; c += 1) a[col][c] = (a[col][c] as number) / p;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const f = a[r]?.[col] ?? 0;
            for (let c = col; c <= n; c += 1) a[r][c] = (a[r][c] as number) - f * (a[col][c] as number);
        }
    }
    return a.map((row) => row[n] as number);
}

/** Independent circumsphere used only by the brute-force oracle. */
function sphere(pts: Vec[], sim: Simplex): { c: Vec; r2: number } | null {
    const d = sim.length - 1;
    const p0 = pts[sim[0] as number] as Vec;
    const rows: number[][] = [];
    const rhs: number[] = [];
    for (let i = 1; i <= d; i += 1) {
        const pi = pts[sim[i] as number] as Vec;
        rows.push(pi.map((v, k) => 2 * (v - (p0[k] as number))));
        rhs.push(pi.reduce((s, v, k) => s + v * v - (p0[k] as number) ** 2, 0));
    }
    const c = solve(rows, rhs);
    if (!c) return null;
    const r2 = c.reduce((s, v, k) => s + (v - (p0[k] as number)) ** 2, 0);
    return { c, r2 };
}

/** Brute-force ground truth: every (d+1)-subset whose circumsphere is empty. */
function bruteForce(pts: Vec[], d: number): Set<string> {
    const result = new Set<string>();
    const n = pts.length;
    const combo: number[] = [];
    const visit = (start: number, depth: number): void => {
        if (depth === d + 1) {
            const sim = [...combo].sort((a, b) => a - b);
            const s = sphere(pts, sim);
            if (!s) return;
            for (let i = 0; i < n; i += 1) {
                if (sim.includes(i)) continue;
                const q = pts[i] as Vec;
                const dist = s.c.reduce((acc, v, k) => acc + (q[k] - v) ** 2, 0);
                if (dist < s.r2 - 1e-9) return;
            }
            result.add(sim.join(","));
            return;
        }
        for (let i = start; i < n; i += 1) {
            combo.push(i);
            visit(i + 1, depth + 1);
            combo.pop();
        }
    };
    visit(0, 0);
    return result;
}

function framesFor(input: unknown) {
    const frames = [];
    const gen = multidimensionalDelaunay.run(input);
    for (let guard = 0; guard < 1000; guard += 1) {
        const next = gen.next();
        if (next.done) break;
        frames.push(next.value);
        expect(frames.length).toBeLessThan(1000);
    }
    return frames;
}

function assertFrameShapes(frames: ReturnType<typeof framesFor>): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.layout).toBe("point");
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(multidimensionalDelaunay.pseudocode?.length ?? 0);
        expect(frame.entities.length).toBeGreaterThan(0);
        for (const e of frame.entities) {
            expect(Number.isFinite(e.x)).toBe(true);
            expect(Number.isFinite(e.y)).toBe(true);
        }
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(typeof frame.meta.pointCount).toBe("number");
    });
}

const POINTS_3D: Vec[] = [
    [0, 0, 0],
    [3, 0, 1],
    [0, 4, 0],
    [4, 4, 2],
    [1, 1, 3],
    [5, 2, 1],
    [2, 5, 4],
    [6, 6, 0],
];

const POINTS_2D: Vec[] = [
    [0, 0],
    [4, 0],
    [5, 3],
    [2, 5],
    [-1, 2],
    [3, 1],
];

describe("multidimensionalDelaunay", () => {
    it("matches a brute-force empty-circumsphere oracle in 3D", () => {
        const frames = framesFor({ points: POINTS_3D, dimension: 3 });
        assertFrameShapes(frames);
        const keys = (frames[frames.length - 1]?.meta.simplexKeys as string[]) ?? [];
        expect(new Set(keys).size).toBe(keys.length);
        expect(new Set(keys)).toEqual(bruteForce(POINTS_3D, 3));
    });

    it("matches a brute-force empty-circumsphere oracle in 2D", () => {
        const frames = framesFor({ points: POINTS_2D, dimension: 2 });
        assertFrameShapes(frames);
        const keys = (frames[frames.length - 1]?.meta.simplexKeys as string[]) ?? [];
        expect(new Set(keys)).toEqual(bruteForce(POINTS_2D, 2));
    });

    it("satisfies the empty-circumsphere property on its own output", () => {
        const frames = framesFor(multidimensionalDelaunay.defaultInput);
        const keys = (frames[frames.length - 1]?.meta.simplexKeys as string[]) ?? [];
        for (const key of keys) {
            const sim = key.split(",").map(Number);
            const s = sphere(POINTS_3D, sim);
            expect(s).not.toBeNull();
            if (!s) continue;
            for (let i = 0; i < POINTS_3D.length; i += 1) {
                if (sim.includes(i)) continue;
                const q = POINTS_3D[i] as Vec;
                const dist = s.c.reduce((acc, v, k) => acc + (q[k] - v) ** 2, 0);
                expect(dist).toBeGreaterThanOrEqual(s.r2 - 1e-9);
            }
        }
    });

    it("terminates with a graceful frame when too few points are given", () => {
        const frames = framesFor({ points: [[0, 0], [1, 1]], dimension: 2 });
        expect(frames.length).toBeGreaterThanOrEqual(2);
        expect(frames[frames.length - 1]?.meta.simplexKeys).toEqual([]);
        expect(frames[frames.length - 1]?.description).toMatch(/at least/i);
    });
});
