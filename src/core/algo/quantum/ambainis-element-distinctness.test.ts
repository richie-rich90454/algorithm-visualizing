/**
 * ambainis-element-distinctness.test.ts - Collision detection and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { collisionPairs } from "./ambainis-element-distinctness";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent O(n^2) duplicate finder. */
function bruteCollisions(values: number[]): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < values.length; i += 1) {
        for (let j = i + 1; j < values.length; j += 1) {
            if (values[i] === values[j]) {
                out.push([i, j]);
            }
        }
    }
    return out;
}

describe("Ambainis Element Distinctness", () => {
    it("marks exactly the subsets found by brute-force duplicate search", () => {
        const values = [3, 1, 4, 1, 5, 1];
        expect(collisionPairs(values)).toEqual(bruteCollisions(values));
    });

    it("finds a genuine colliding pair in the final frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const values = final?.["values"] as number[];
        const collisions = final?.["collisions"] as Array<[number, number]>;
        const found = final?.["foundPair"] as [number, number] | null;
        expect(collisions).toEqual(bruteCollisions(values));
        expect(found).not.toBeNull();
        expect(collisions).toContainEqual(found as [number, number]);
        expect(values[found![0] as number]).toBe(values[found![1] as number]);
        expect(Number(final?.["success"])).toBeGreaterThan(0.5);
        const probabilities = final?.["probabilities"] as number[];
        expect(probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    });

    it("reports no collision for all-distinct inputs", () => {
        const frames = [...mod.run({ values: [1, 2, 3, 4, 5] })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["foundPair"]).toBeNull();
        expect(Number(final?.["success"])).toBe(0);
        expect(final?.["correct"]).toBe(false);
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
