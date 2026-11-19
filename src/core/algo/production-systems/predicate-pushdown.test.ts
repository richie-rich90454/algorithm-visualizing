/**
 * predicate-pushdown.test.ts - Independent naive-plan reference, result
 * equivalence, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./predicate-pushdown";
import type { VisualFrame } from "@/types";

type LeftRow = [number, number];
type RightRow = [number, number];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function naive(left: LeftRow[], right: RightRow[], threshold: number): string[] {
    const out: string[] = [];
    for (const l of left) {
        for (const r of right) {
            if (l[0] === r[0] && r[1] >= threshold) {
                out.push(`id${l[0]}:cat${l[1]}:v${r[1]}`);
            }
        }
    }
    return out;
}

describe("predicate pushdown", () => {
    const cases: Array<{ left: LeftRow[]; right: RightRow[]; threshold: number }> = [
        {
            left: [
                [1, 10],
                [2, 20],
                [3, 30],
                [4, 40],
            ],
            right: [
                [1, 5],
                [1, 80],
                [2, 50],
                [3, 20],
                [4, 90],
            ],
            threshold: 50,
        },
        {
            left: [
                [1, 1],
                [2, 2],
            ],
            right: [
                [1, 100],
                [1, 200],
                [2, 1],
            ],
            threshold: 50,
        },
        {
            left: [[7, 7]],
            right: [
                [7, 0],
                [7, 9],
            ],
            threshold: 5,
        },
    ];

    it("produces exactly the same rows as a filter-after-join plan", () => {
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames);
            const last = frames[frames.length - 1]?.meta;
            expect(last?.["matches"]).toEqual(naive(c.left, c.right, c.threshold));
        }
    });

    it("never increases the number of join candidates", () => {
        for (const c of cases) {
            const frames = [...mod.run(c)];
            const last = frames[frames.length - 1]?.meta;
            expect(Number(last?.["pushdownPairs"])).toBeLessThanOrEqual(
                Number(last?.["naivePairs"]),
            );
        }
    });

    it("removes failing right rows before the join", () => {
        const frames = [...mod.run(cases[0])];
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["matches"]).toEqual(["id1:cat10:v80", "id2:cat20:v50", "id4:cat40:v90"]);
        expect(last?.["duplicateResult"]).toBe(true);
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
