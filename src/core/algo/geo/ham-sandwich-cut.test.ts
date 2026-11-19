/**
 * ham-sandwich-cut.test.ts - Independent bisection property check, frame shape,
 * and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./ham-sandwich-cut";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function project(p: Point, angle: number): number {
    return p[0] * Math.cos(angle) + p[1] * Math.sin(angle);
}

/** Independent dense-grid search for a direction where the A-median bisects B. */
function bruteForceExists(a: Point[], b: Point[]): boolean {
    const halfA = Math.floor(a.length / 2);
    const halfB = Math.floor(b.length / 2);
    for (let k = 0; k < 2000; k += 1) {
        const angle = (k / 2000) * Math.PI;
        const values = a.map((p) => project(p, angle)).sort((x, y) => x - y);
        let offset: number;
        if (a.length % 2 === 0) {
            offset = ((values[halfA - 1] as number) + (values[halfA] as number)) / 2;
        } else {
            offset = values[halfA] as number;
        }
        let below = 0;
        let above = 0;
        for (const p of b) {
            const value = project(p, angle) - offset;
            if (value > 1e-9) {
                above += 1;
            } else if (value < -1e-9) {
                below += 1;
            }
        }
        if (below <= halfB && above <= halfB) {
            return true;
        }
    }
    return false;
}

function checkFrames(frames: VisualFrame[], minimumEntities: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThanOrEqual(minimumEntities);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Ham Sandwich Cut", () => {
    it("returns a line that bisects both sets and agrees with a dense search", () => {
        const cases: Array<{ setA: Point[]; setB: Point[] }> = [
            {
                setA: [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0], [5, 1]],
                setB: [[0, 3], [1, 2], [2, 4], [3, 2], [4, 4], [5, 3]],
            },
            {
                setA: [[1, 1], [2, 5], [3, 2], [6, 4], [7, 1], [8, 6]],
                setB: [[0, 0], [4, 7], [5, 1], [6, 6], [9, 2], [10, 8]],
            },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.setA.length + input.setB.length);
            const final = frames[frames.length - 1] as VisualFrame;
            expect(final.meta["found"]).toBe(true);
            const splitA = final.meta["splitA"] as number[];
            const splitB = final.meta["splitB"] as number[];
            expect(splitA[0]).toBeLessThanOrEqual(Math.floor(input.setA.length / 2));
            expect(splitA[1]).toBeLessThanOrEqual(Math.floor(input.setA.length / 2));
            expect(splitB[0]).toBeLessThanOrEqual(Math.floor(input.setB.length / 2));
            expect(splitB[1]).toBeLessThanOrEqual(Math.floor(input.setB.length / 2));
            expect(bruteForceExists(input.setA, input.setB)).toBe(true);
        }
    });

    it("handles tiny sets", () => {
        const input = { setA: [[0, 0], [2, 2]] as Point[], setB: [[0, 3], [3, 0]] as Point[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, 4);
        expect(frames[frames.length - 1]?.meta["found"]).toBe(true);
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
