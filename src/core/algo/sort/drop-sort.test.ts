import { describe, expect, it } from "vitest";
import mod from "./drop-sort";

function reference(values: number[]): number[] {
    const kept: number[] = [];
    for (const value of values) {
        if (kept.length === 0 || value >= (kept[kept.length - 1] as number)) {
            kept.push(value);
        }
    }
    return kept;
}

function isSubsequence(sub: number[], full: number[]): boolean {
    let j = 0;
    for (const value of full) {
        if (j < sub.length && sub[j] === value) {
            j += 1;
        }
    }
    return j === sub.length;
}

function frames(values?: number[]) {
    return [...mod.run(values === undefined ? mod.defaultInput : { values })];
}

describe("Drop Sort", () => {
    it("matches a brute-force reference and produces a sorted subsequence", () => {
        const inputs: number[][] = [
            [],
            [1],
            [3, 1, 4, 1, 5, 9, 2, 6, 5],
            [5, 4, 3, 2, 1],
            [1, 2, 3, 4, 5],
            [2, 2, 2, 2],
            [-3, 0, -1, 7, 7, 4],
        ];
        for (const values of inputs) {
            const all = frames(values);
            const final = all[all.length - 1];
            expect(final).toBeDefined();
            const kept = final!.meta["kept"] as number[];
            expect(kept).toEqual(reference(values));
            for (let i = 1; i < kept.length; i += 1) {
                expect(kept[i]!).toBeGreaterThanOrEqual(kept[i - 1]!);
            }
            expect(isSubsequence(kept, values)).toBe(true);
        }
    });

    it("emits well-formed frames with sequential steps and in-range code lines", () => {
        const all = frames();
        expect(all.length).toBeGreaterThan(2);
        all.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.layout).toBe("array");
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
            expect(frame.entities.length).toBeGreaterThan(0);
            for (const entity of frame.entities) {
                expect(entity.type).toBe("bar");
                expect(typeof entity.label).toBe("string");
            }
            expect(typeof frame.meta["keptCount"]).toBe("number");
        });
    });

    it("terminates cleanly", () => {
        let count = 0;
        for (const _frame of mod.run(mod.defaultInput)) {
            count += 1;
            expect(count).toBeLessThan(1000);
        }
        expect(count).toBeGreaterThan(0);
    });
});
