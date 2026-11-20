/**
 * sde-solver.test.ts - Independent Euler-Maruyama recomputation,
 * deterministic and zero-noise properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { eulerMaruyama, standardNormals } from "./sde-solver";
import type { VisualFrame } from "@/types";

const STATES = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

/** Independent Box-Muller sequence and SDE integration. */
function reference(initial: number[], theta: number, diffusion: number, dt: number, steps: number, seed: number) {
    let s = seed >>> 0;
    const u = () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
    const z: number[] = [];
    for (let i = 0; i < steps * initial.length; i += 1) {
        const u1 = Math.max(u(), 1e-12);
        const u2 = u();
        z.push(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
    }
    let x = initial.slice();
    const traj = [x.slice()];
    for (let k = 0; k < steps; k += 1) {
        x = x.map((v, i) => v + (-theta * v) * dt + diffusion * Math.sqrt(dt) * z[k * initial.length + i]);
        traj.push(x.slice());
    }
    return traj;
}

function expectCloseMatrix(got: number[][], ref: number[][]): void {
    expect(got.length).toBe(ref.length);
    for (let i = 0; i < got.length; i += 1) {
        expect(got[i].length).toBe(ref[i].length);
        for (let j = 0; j < got[i].length; j += 1) {
            expect(got[i][j]).toBeCloseTo(ref[i][j], 10);
        }
    }
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) expect(STATES.has(entity.state)).toBe(true);
    });
}

describe("Euler-Maruyama SDE solver", () => {
    it("matches an independent integration on random configurations", () => {
        for (let seed = 0; seed < 12; seed += 1) {
            const initial = Array.from({ length: 3 }, (_, i) => (i + seed) / 3 - 1);
            const got = eulerMaruyama(initial, 0.5 + seed / 10, 0.3 + seed / 20, 0.05 + seed / 200, 4 + (seed % 3), seed);
            const ref = reference(initial, 0.5 + seed / 10, 0.3 + seed / 20, 0.05 + seed / 200, 4 + (seed % 3), seed);
            expectCloseMatrix(got, ref);
        }
    });

    it("follows deterministic decay with zero diffusion and is reproducible", () => {
        const traj = eulerMaruyama([1, -2], 1, 0, 0.1, 5, 7);
        expect(traj.length).toBe(6);
        for (let k = 0; k <= 5; k += 1) {
            expect(traj[k][0]).toBeCloseTo(Math.pow(0.9, k), 10);
            expect(traj[k][1]).toBeCloseTo(-2 * Math.pow(0.9, k), 10);
        }
        const noisy = eulerMaruyama([1, -2], 1, 0.4, 0.1, 5, 7);
        expect(noisy[5][0]).not.toBeCloseTo(traj[5][0], 6);
        expect(noisy).toEqual(eulerMaruyama([1, -2], 1, 0.4, 0.1, 5, 7));
        expect(standardNormals(4, 99)).toEqual(standardNormals(4, 99));
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames.length).toBe(2 + Number((mod.defaultInput as { steps: number }).steps));
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
