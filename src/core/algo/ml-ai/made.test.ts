/** made.test.ts - Independent mask-composition oracle, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./made";
import type { VisualFrame } from "@/types";

interface Input {
    order: number[];
    degrees: number[][];
}

function reference(input: Input) {
    const dim = input.order.length;
    const masks: number[][][] = [];
    let source = input.order.slice();
    for (const target of input.degrees) {
        masks.push(target.map((t) => source.map((s) => (t >= s ? 1 : 0))));
        source = target;
    }
    masks.push(input.order.map((t) => source.map((s) => (t > s ? 1 : 0))));
    let dependency = masks[0] ?? [];
    for (let layer = 1; layer < masks.length; layer += 1) {
        const left = masks[layer] ?? [];
        const next: number[][] = [];
        for (let i = 0; i < left.length; i += 1) {
            const row: number[] = [];
            for (let j = 0; j < (dependency[0] ?? []).length; j += 1) {
                let value = 0;
                for (let k = 0; k < (left[i] ?? []).length; k += 1) {
                    if ((left[i]?.[k] ?? 0) === 1 && (dependency[k]?.[j] ?? 0) === 1) {
                        value = 1;
                        break;
                    }
                }
                row.push(value);
            }
            next.push(row);
        }
        dependency = next;
    }
    const expected = input.order.map((a) => input.order.map((b) => (a > b ? 1 : 0)));
    return { masks, dependency, expected };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("MADE", () => {
    it("matches an independent mask-composition oracle", () => {
        const cases: Input[] = [
            { order: [3, 1, 4, 2], degrees: [[1, 2, 3, 1], [2, 3, 1, 2]] },
            { order: [1, 2, 3], degrees: [[1, 2, 1]] },
            { order: [4, 3, 2, 1], degrees: [[1, 2, 3, 1]] },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["masks"]).toEqual(expected.masks);
            expect(meta?.["dependency"]).toEqual(expected.dependency);
            expect(meta?.["expected"]).toEqual(expected.expected);
            expect(meta?.["valid"]).toBe(true);
        }
    });

    it("always yields the strict greater-than dependency", () => {
        const orders = [[2, 1, 3], [1, 3, 2, 4], [5, 1, 4, 2, 3]];
        for (const order of orders) {
            const degrees = [1, 2].map(() => Array.from({ length: order.length }, (_, i) => 1 + (i % (order.length - 1))));
            const meta = [...mod.run({ order, degrees })].at(-1)?.meta;
            expect(meta?.["valid"]).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
