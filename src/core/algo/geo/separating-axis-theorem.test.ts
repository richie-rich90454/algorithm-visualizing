/** separating-axis-theorem.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./separating-axis-theorem";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function cross(a: Point, b: Point, c: Point): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Independent intersection check via Sutherland-Hodgman clipping. */
function clippedArea(subject: Point[], clip: Point[]): number {
    let output = subject.slice();
    for (let i = 0; i < clip.length && output.length > 0; i += 1) {
        const a = clip[i] as Point;
        const b = clip[(i + 1) % clip.length] as Point;
        const input = output;
        output = [];
        for (let j = 0; j < input.length; j += 1) {
            const current = input[j] as Point;
            const next = input[(j + 1) % input.length] as Point;
            const currentInside = cross(a, b, current) >= 0;
            const nextInside = cross(a, b, next) >= 0;
            if (currentInside) {
                output.push(current);
            }
            if (currentInside !== nextInside) {
                const d1 = cross(a, b, current);
                const d2 = cross(a, b, next);
                const t = d1 / (d1 - d2);
                output.push([current[0] + t * (next[0] - current[0]), current[1] + t * (next[1] - current[1])]);
            }
        }
    }
    let area = 0;
    for (let i = 0; i < output.length; i += 1) {
        const p = output[i] as Point;
        const q = output[(i + 1) % output.length] as Point;
        area += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(area) / 2;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Separating Axis Theorem", () => {
    it("agrees with an independent clipping-based intersection test", () => {
        const rect: Point[] = [
            [0, 0],
            [4, 0],
            [4, 3],
            [0, 3],
        ];
        const cases: Array<{ a: Point[]; b: Point[] }> = [
            { a: rect, b: [[6, 1], [8, 1], [8, 4], [6, 4]] },
            { a: rect, b: [[2, 1], [5, 1], [5, 2], [2, 2]] },
            { a: rect, b: [[1, 1], [2, 1], [2, 2], [1, 2]] },
            {
                a: [[0, 0], [4, 0], [2, 4]],
                b: [[5, 0], [9, 0], [5, 4]],
            },
            {
                a: [[0, 0], [4, 0], [2, 4]],
                b: [[2, 1], [6, 1], [4, 3]],
            },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ polygonA: testCase.a, polygonB: testCase.b })];
            checkFrames(frames);
            const verdict = frames[frames.length - 1]?.meta["intersect"];
            const expected = clippedArea(testCase.a, testCase.b) > 1e-9;
            expect(verdict, `SAT verdict for ${JSON.stringify(testCase.b)}`).toBe(expected);
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
