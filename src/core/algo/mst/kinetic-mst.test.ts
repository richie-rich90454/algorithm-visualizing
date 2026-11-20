/**
 * kinetic-mst.test.ts - Correctness against an independent Prim reference,
 * frame shape, and termination checks for the kinetic minimum spanning tree.
 */

import { describe, expect, it } from "vitest";
import mod from "./kinetic-mst";
import type { VisualFrame } from "@/types";

interface MovingPoint {
    x: number;
    y: number;
    vx: number;
    vy: number;
}

/** Independent Prim MST weight on a fixed set of 2D positions. */
function referenceMstWeight(positions: Array<[number, number]>): number {
    const n = positions.length;
    if (n <= 1) {
        return 0;
    }
    const used = new Array<boolean>(n).fill(false);
    const best = new Array<number>(n).fill(Infinity);
    best[0] = 0;
    let total = 0;
    for (let iter = 0; iter < n; iter += 1) {
        let pick = -1;
        for (let i = 0; i < n; i += 1) {
            if (!used[i] && (pick === -1 || (best[i] as number) < (best[pick] as number))) {
                pick = i;
            }
        }
        if (pick === -1) {
            break;
        }
        used[pick] = true;
        total += best[pick] as number;
        const p = positions[pick] as [number, number];
        for (let j = 0; j < n; j += 1) {
            if (!used[j]) {
                const q = positions[j] as [number, number];
                const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
                if (d < (best[j] as number)) {
                    best[j] = d;
                }
            }
        }
    }
    return total;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(n === 0 ? 1 : n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Kinetic MST", () => {
    it("matches an independent Prim reference at every sampled time", () => {
        const input = mod.defaultInput as { points: MovingPoint[]; times: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);

        const samples = frames.filter((frame) => frame.meta["phase"] === "sample");
        expect(samples.length).toBe(input.times.length);
        samples.forEach((frame, index) => {
            const time = input.times[index] as number;
            const positions = input.points.map(
                (p) => [p.x + p.vx * time, p.y + p.vy * time] as [number, number],
            );
            expect(Number(frame.meta["mstWeight"])).toBeCloseTo(referenceMstWeight(positions), 6);
            expect(frame.meta["mstEdges"]).toBe(Math.max(0, positions.length - 1));
        });
    });

    it("handles stationary, duplicate, and tiny point sets", () => {
        const cases: Array<{ points: MovingPoint[]; times: number[] }> = [
            { points: [], times: [0, 1] },
            { points: [{ x: 2, y: 2, vx: 0, vy: 0 }], times: [0, 5] },
            {
                points: [
                    { x: 0, y: 0, vx: 0, vy: 0 },
                    { x: 0, y: 0, vx: 1, vy: 0 },
                    { x: 3, y: 4, vx: 0, vy: 0 },
                ],
                times: [0, 1, 2],
            },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.points.length);
            const samples = frames.filter((frame) => frame.meta["phase"] === "sample");
            samples.forEach((frame, index) => {
                const time = input.times[index] as number;
                const positions = input.points.map(
                    (p) => [p.x + p.vx * time, p.y + p.vy * time] as [number, number],
                );
                expect(Number(frame.meta["mstWeight"])).toBeCloseTo(referenceMstWeight(positions), 6);
            });
        }
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
