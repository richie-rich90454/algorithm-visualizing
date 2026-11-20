import { describe, expect, it } from "vitest";
import mod from "./lseq-crdt";
import type { VisualFrame } from "@/types";

type InsertOp = { op: number; site: number; anchor: number; char: string };

function reference(ops: InsertOp[]): string {
    const byId = new Map(ops.map((op) => [op.op, op]));
    const memo = new Map<number, number[]>();
    const resolve = (op: InsertOp): number[] => {
        const cached = memo.get(op.op);
        if (cached) {
            return cached;
        }
        if (op.anchor < 0 || !byId.has(op.anchor)) {
            const id = [op.site, op.op];
            memo.set(op.op, id);
            return id;
        }
        const parent = byId.get(op.anchor) as InsertOp;
        const id = [...resolve(parent), op.site, op.op];
        memo.set(op.op, id);
        return id;
    };
    const cmp = (a: number[], b: number[]) => {
        for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
            if (a[i] !== b[i]) {
                return (a[i] as number) - (b[i] as number);
            }
        }
        return a.length - b.length;
    };
    return ops
        .map((op) => ({ char: op.char, id: resolve(op) }))
        .sort((a, b) => cmp(a.id, b.id))
        .map((entry) => entry.char)
        .join("");
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("LSEQ-Style Sequence CRDT", () => {
    it("converges regardless of delivery order", () => {
        const ops = (mod.defaultInput as { ops: InsertOp[] }).ops;
        const expected = reference(ops);
        for (const order of [ops, [...ops].reverse(), [ops[2] as InsertOp, ops[0] as InsertOp, ops[3] as InsertOp, ops[1] as InsertOp]]) {
            const frames = [...mod.run({ ops: order })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["converged"]).toBe(true);
            expect(final?.["sequence"]).toBe(expected);
        }
    });

    it("keeps each insert after its anchor and matches brute force", () => {
        const ops: InsertOp[] = [
            { op: 1, site: 0, anchor: -1, char: "a" },
            { op: 2, site: 2, anchor: 1, char: "b" },
            { op: 3, site: 1, anchor: 1, char: "c" },
            { op: 4, site: 0, anchor: 3, char: "d" },
            { op: 5, site: 3, anchor: -1, char: "e" },
        ];
        const frames = [...mod.run({ ops })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const sequence = String(final?.["sequence"]);
        expect(sequence).toBe(reference(ops));
        expect(sequence.indexOf("b")).toBeGreaterThan(sequence.indexOf("a"));
        expect(sequence.indexOf("c")).toBeGreaterThan(sequence.indexOf("a"));
        expect(sequence.indexOf("d")).toBeGreaterThan(sequence.indexOf("c"));
        expect(frames.length).toBe(ops.length + 2);
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
