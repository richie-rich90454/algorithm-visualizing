/** chain-of-thought.test.ts - Decomposition, fold equivalence, and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./chain-of-thought";
import type { VisualFrame } from "@/types";

interface Operation {
    op: "+" | "-" | "*" | "/";
    value: number;
}
interface Input {
    start: number;
    operations: Operation[];
}

function apply(current: number, operation: Operation): number {
    switch (operation.op) {
        case "+": return current + operation.value;
        case "-": return current - operation.value;
        case "*": return current * operation.value;
        case "/": return operation.value === 0 ? current : current / operation.value;
    }
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Chain of Thought", () => {
    it("final value matches a brute-force fold", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.operations.length + 1);
        let expected = input.start;
        for (const operation of input.operations) {
            expected = apply(expected, operation);
        }
        expect(frames[frames.length - 1]?.meta["final"]).toBeCloseTo(expected, 12);
    });

    it("every intermediate step is the previous value with one operation applied", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const values = frames[frames.length - 1]?.meta["values"] as number[];
        expect(values[0]).toBe(input.start);
        for (let i = 0; i < input.operations.length; i += 1) {
            expect(values[i + 1]).toBeCloseTo(apply(values[i] ?? 0, input.operations[i] as Operation), 12);
        }
    });

    it("works with an empty chain and with a different start", () => {
        const empty = [...mod.run({ start: 7, operations: [] })];
        checkFrames(empty, 1);
        expect(empty[empty.length - 1]?.meta["final"]).toBe(7);

        const input: Input = {
            start: 10,
            operations: [{ op: "-", value: 4 }, { op: "*", value: 3 }],
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, 3);
        expect(frames[frames.length - 1]?.meta["final"]).toBe(18);
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
