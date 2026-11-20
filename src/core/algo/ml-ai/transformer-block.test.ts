/**
 * transformer-block.test.ts - Independent matrix math, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./transformer-block";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
interface Input { Q: Matrix; K: Matrix; V: Matrix; W: Matrix; b: number[] }

function multiply(a: Matrix, b: Matrix): Matrix {
    return a.map((row) => b[0]?.map((_, col) => row.reduce((acc, v, k) => acc + v * (b[k]?.[col] ?? 0), 0)) ?? []);
}
function transpose(m: Matrix): Matrix {
    return m[0]?.map((_, col) => m.map((row) => row[col] ?? 0)) ?? [];
}
function softmax(row: number[]): number[] {
    const max = Math.max(...row);
    const e = row.map((v) => Math.exp(v - max));
    const t = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / t);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(2);
    });
}

describe("TransformerBlock", () => {
    it("matches independent attention matrix math", () => {
        const cfg = mod.defaultInput as Input;
        const frames = [...mod.run(cfg)];
        checkFrames(frames);
        const dk = Math.sqrt(cfg.Q[0]?.length ?? 1);
        const scores = multiply(cfg.Q, transpose(cfg.K)).map((row) => row.map((v) => v / dk));
        const attn = scores.map(softmax);
        const context = multiply(attn, cfg.V);

        const attentionFrame = frames[1];
        const rowSums = attentionFrame?.meta["rowSums"] as number[];
        rowSums.forEach((sum) => expect(sum).toBeCloseTo(1, 6));
        const cells = attentionFrame?.entities ?? [];
        for (let i = 0; i < cells.length; i += 1) {
            const row = Math.floor(i / 2);
            const col = i % 2;
            expect(Number(cells[i]?.value)).toBeCloseTo(attn[row]?.[col] ?? 0, 5);
        }
        expect(Number(frames[2]?.entities[0]?.value)).toBeCloseTo(context[0]?.[0] ?? 0, 5);
    });

    it("produces nonnegative feed-forward output and normalization invariants", () => {
        const cfg: Input = {
            Q: [[2, -1], [0.5, 1.5]],
            K: [[1, 0], [2, 1]],
            V: [[1, 1], [2, 3]],
            W: [[1, 2], [-1, 1]],
            b: [0.1, 0.2],
        };
        const frames = [...mod.run(cfg)];
        checkFrames(frames);
        const out = frames[4]?.meta["outputRow0"] as number[];
        out.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));

        const normed = frames[3]?.entities ?? [];
        const firstRow = normed.slice(0, 2).map((e) => Number(e.value));
        const mean = firstRow.reduce((a, b) => a + b, 0) / 2;
        expect(Math.abs(mean)).toBeLessThan(1e-6);
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
