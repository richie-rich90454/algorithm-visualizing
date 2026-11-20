/** vectorized-query-execution.test.ts - Scalar brute-force cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./vectorized-query-execution";
import type { VisualFrame } from "@/types";

type Columns = Record<string, Array<number | string>>;
type Predicate = { column: string; op: "eq" | "gt" | "lt"; value: number | string };

/** Straight row-at-a-time reference for the same query. */
function scalarQuery(columns: Columns, predicate: Predicate, measure: string, aggregate: "sum" | "count") {
    const n = (columns[Object.keys(columns)[0] as string] ?? []).length;
    let selected = 0;
    let sum = 0;
    for (let row = 0; row < n; row += 1) {
        const v = columns[predicate.column]?.[row] ?? "";
        let pass = false;
        if (predicate.op === "eq") pass = v === predicate.value;
        else if (predicate.op === "gt") pass = Number(v) > Number(predicate.value);
        else pass = Number(v) < Number(predicate.value);
        if (pass) {
            selected += 1;
            sum += Number(columns[measure]?.[row] ?? 0);
        }
    }
    return { selected, total: aggregate === "sum" ? sum : selected };
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Vectorized Query Execution", () => {
    it("matches a scalar query for various predicates, aggregates, and batch sizes", () => {
        const columns: Columns = {
            region: ["A", "B", "A", "C", "B", "A", "C", "A", "B", "A"],
            sales: [12, 7, 25, 4, 18, 30, 9, 11, 2, 15],
        };
        const cases: Array<{ predicate: Predicate; aggregate: "sum" | "count"; batch: number }> = [
            { predicate: { column: "region", op: "eq", value: "A" }, aggregate: "sum", batch: 4 },
            { predicate: { column: "region", op: "eq", value: "B" }, aggregate: "count", batch: 3 },
            { predicate: { column: "sales", op: "gt", value: 10 }, aggregate: "sum", batch: 1 },
            { predicate: { column: "sales", op: "lt", value: 10 }, aggregate: "count", batch: 6 },
        ];
        for (const testCase of cases) {
            const input = { columns, predicate: testCase.predicate, measure: "sales", aggregate: testCase.aggregate, batchSize: testCase.batch };
            const frames = [...mod.run(input)];
            checkFrames(frames, 10, 3);
            const final = frames[frames.length - 1]?.meta;
            const expected = scalarQuery(columns, testCase.predicate, "sales", testCase.aggregate);
            expect(Number(final?.["total"])).toBe(expected.total);
            expect(Number(final?.["selected"])).toBe(expected.selected);
        }
    });

    it("processes exactly ceil(n/batch) batch frames with accumulating totals", () => {
        const columns: Columns = { key: [1, 2, 3, 4, 5], val: [10, 20, 30, 40, 50] };
        const frames = [...mod.run({ columns, predicate: { column: "key", op: "gt", value: 1 }, measure: "val", aggregate: "sum", batchSize: 2 })];
        // setup + 3 batches + final
        expect(frames.length).toBe(5);
        const processed = frames.map((f) => Number(f.meta["processed"]));
        expect(processed).toEqual([0, 2, 4, 5, 5]);
        const partials = frames.map((f) => Number(f.meta["partial"]));
        expect(partials).toEqual([0, 20, 90, 140, 140]);
    });

    it("handles a predicate that matches nothing", () => {
        const columns: Columns = { key: [1, 2, 3], val: [5, 6, 7] };
        const final = [...mod.run({ columns, predicate: { column: "key", op: "eq", value: 99 }, measure: "val", aggregate: "sum", batchSize: 2 })].at(-1)?.meta;
        expect(Number(final?.["selected"])).toBe(0);
        expect(Number(final?.["total"])).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
