/** soft-moe.test.ts - Softmax, normalization, brute-force output, frame checks. */

import { describe, expect, it } from "vitest";
import mod, { softmax, softMoeForward } from "./soft-moe";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Soft Mixture of Experts", () => {
    it("softmax is normalized and invariant to a constant shift", () => {
        const a = softmax([1, 2, 3]);
        expect(a.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 10);
        const b = softmax([101, 102, 103]);
        a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 8));
    });

    it("combine rows and dispatch columns sum to one", () => {
        const tokens = [
            [1, 0],
            [0, 1],
            [1, 1],
        ];
        const routers = [
            [1, 0],
            [0, 1],
        ];
        const experts = [
            [
                [1, 0],
                [0, 1],
            ],
            [
                [0, 1],
                [1, 0],
            ],
        ];
        const r = softMoeForward(tokens, routers, experts);
        r.combine.forEach((row) => expect(row.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 10));
        for (let j = 0; j < routers.length; j += 1) {
            const colSum = r.dispatch.reduce((s, row) => s + (row[j] ?? 0), 0);
            expect(colSum).toBeCloseTo(1, 10);
        }
    });

    it("output matches a brute-force slot and blend computation", () => {
        const tokens = [
            [1, 2],
            [3, 1],
        ];
        const routers = [
            [1, 0],
            [0, 1],
        ];
        const experts = [
            [
                [2, 0],
                [0, 1],
            ],
            [
                [1, 1],
                [0, 2],
            ],
        ];
        const r = softMoeForward(tokens, routers, experts);
        const n = tokens.length;
        const e = routers.length;
        // Independent computation of dispatch, slots, expert outputs, and result.
        const logits = tokens.map((t) => routers.map((rv) => t[0]! * rv[0]! + t[1]! * rv[1]!));
        const dispatch = Array.from({ length: n }, () => Array.from({ length: e }, () => 0));
        for (let j = 0; j < e; j += 1) {
            const column = softmax(logits.map((row) => row[j]!));
            for (let t = 0; t < n; t += 1) dispatch[t]![j] = column[t]!;
        }
        const combine = logits.map((row) => softmax(row));
        for (let t = 0; t < n; t += 1) {
            for (let j = 0; j < e; j += 1) {
                expect(r.dispatch[t]![j]).toBeCloseTo(dispatch[t]![j]!, 10);
                expect(r.combine[t]![j]).toBeCloseTo(combine[t]![j]!, 10);
            }
        }
        // Each expert slot is the dispatch-weighted average over all tokens.
        const expertOut = Array.from({ length: e }, () => Array.from({ length: 2 }, () => 0));
        for (let j = 0; j < e; j += 1) {
            for (let i = 0; i < 2; i += 1) {
                let slot = 0;
                for (let t = 0; t < n; t += 1) slot += dispatch[t]![j]! * tokens[t]![i]!;
                expect(r.slots[j]![i]).toBeCloseTo(slot, 10);
                for (let o = 0; o < 2; o += 1) {
                    expertOut[j]![o] += experts[j]![o]![i]! * slot;
                }
            }
        }
        for (let t = 0; t < n; t += 1) {
            for (let o = 0; o < 2; o += 1) {
                let expected = 0;
                for (let j = 0; j < e; j += 1) {
                    expected += combine[t]![j]! * expertOut[j]![o]!;
                }
                expect(r.result[t]![o]).toBeCloseTo(expected, 9);
            }
        }
    });

    it("produces well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["converged"]).toBe(true);
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe(frames.length);
        expect(gen.next().done).toBe(true);
    });
});
