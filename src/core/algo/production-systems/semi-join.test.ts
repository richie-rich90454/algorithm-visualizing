/**
 * semi-join.test.ts - Independent brute-force join reference, frame shape,
 * equality property, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./semi-join";
import type { VisualFrame } from "@/types";

type Tuple = { id: string; key: number };

/** Brute-force natural join used as the ground truth. */
function bruteJoin(left: Tuple[], right: Tuple[]): string[] {
    const pairs: string[] = [];
    for (const l of left) {
        for (const r of right) {
            if (l.key === r.key) {
                pairs.push(`${l.id}|${r.id}`);
            }
        }
    }
    return pairs;
}

function checkFrames(frames: VisualFrame[], expectedCells: number): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(expectedCells);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Semi-Join Reduction", () => {
    it("equals a brute-force natural join on the default input", () => {
        const input = mod.defaultInput as { left: Tuple[]; right: Tuple[] };
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, input.left.length + input.right.length);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["pairs"]).toEqual(bruteJoin(input.left, input.right));
        expect(final?.["keys"]).toEqual([2, 7]);
        expect(final?.["reduced"]).toEqual(["L1", "L3", "L4"]);
    });

    it("matches brute force across several random-shaped inputs", () => {
        const cases: Array<{ left: Tuple[]; right: Tuple[] }> = [
            { left: [], right: [{ id: "S", key: 1 }] },
            {
                left: [
                    { id: "A", key: 1 },
                    { id: "B", key: 2 },
                    { id: "C", key: 3 },
                ],
                right: [{ id: "X", key: 9 }],
            },
            {
                left: [
                    { id: "A", key: 4 },
                    { id: "B", key: 4 },
                    { id: "C", key: 1 },
                ],
                right: [
                    { id: "X", key: 4 },
                    { id: "Y", key: 4 },
                    { id: "Z", key: 2 },
                ],
            },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["pairs"]).toEqual(bruteJoin(testCase.left, testCase.right));
            const reduced = final?.["reduced"] as string[];
            const allowedKeys = new Set(testCase.right.map((tuple) => tuple.key));
            for (const id of reduced) {
                const tuple = testCase.left.find((value) => value.id === id);
                expect(tuple && allowedKeys.has(tuple.key)).toBe(true);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(3);
        expect(generator.next().done).toBe(true);
    });
});
