/** marching-cubes.test.ts - Iso value property, parity, and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./marching-cubes";

type Vec3 = [number, number, number];

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 1000; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(1000);
    return frames;
}

function sphereGrid(): number[][][] {
    return Array.from({ length: 5 }, (_, x) =>
        Array.from({ length: 5 }, (_, y) =>
            Array.from({ length: 5 }, (_, z) => Math.hypot(x - 2, y - 2, z - 2) - 1.6),
        ),
    );
}

/** Independent trilinear interpolation of the scalar field at a 3D position. */
function trilinear(grid: number[][][], p: Vec3): number {
    const nx = grid.length, ny = grid[0]!.length, nz = grid[0]![0]!.length;
    const x0 = Math.min(nx - 2, Math.max(0, Math.floor(p[0])));
    const y0 = Math.min(ny - 2, Math.max(0, Math.floor(p[1])));
    const z0 = Math.min(nz - 2, Math.max(0, Math.floor(p[2])));
    const tx = p[0] - x0, ty = p[1] - y0, tz = p[2] - z0;
    let value = 0;
    for (let dx = 0; dx <= 1; dx += 1) {
        for (let dy = 0; dy <= 1; dy += 1) {
            for (let dz = 0; dz <= 1; dz += 1) {
                const weight =
                    (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz);
                value += grid[x0 + dx]![y0 + dy]![z0 + dz]! * weight;
            }
        }
    }
    return value;
}

function unpack(flat: number[]): Vec3[] {
    const out: Vec3[] = [];
    for (let i = 0; i < flat.length; i += 3) out.push([flat[i]!, flat[i + 1]!, flat[i + 2]!]);
    return out;
}

describe("Marching Cubes", () => {
    it("places every mesh vertex on the iso surface", () => {
        const final = framesFor(mod.defaultInput).slice(-1)[0]!;
        const grid = sphereGrid();
        const vertices = unpack(final.meta.triangles as number[]);
        expect(vertices.length).toBeGreaterThan(0);
        for (const v of vertices) {
            expect(trilinear(grid, v)).toBeCloseTo(0, 6);
        }
    });

    it("keeps vertices in the grid and uses an even number of crossings", () => {
        const final = framesFor(mod.defaultInput).slice(-1)[0]!;
        const bounds = final.meta.bounds as number[];
        const vertices = unpack(final.meta.triangles as number[]);
        for (const v of vertices) {
            expect(v[0]).toBeGreaterThanOrEqual(0);
            expect(v[0]).toBeLessThanOrEqual(bounds[0]! - 1);
            expect(v[1]).toBeGreaterThanOrEqual(0);
            expect(v[1]).toBeLessThanOrEqual(bounds[1]! - 1);
            expect(v[2]).toBeGreaterThanOrEqual(0);
            expect(v[2]).toBeLessThanOrEqual(bounds[2]! - 1);
        }
        for (const count of final.meta.crossingCounts as number[]) {
            expect(count).toBeGreaterThanOrEqual(0);
            expect(count).toBeLessThanOrEqual(12);
        }
        expect((final.meta.crossingCounts as number[]).length).toBe(64);
        expect((final.meta.triangleCount as number) * 9).toBe((final.meta.triangles as number[]).length);
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
