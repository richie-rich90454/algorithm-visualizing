import { describe, expect, it } from "vitest";
import mod from "./tree-contraction";
import type { VisualFrame } from "@/types";

type Input = {
    parentMap: Record<string, string | null>;
    values: Record<string, number>;
    ops: Record<string, "+" | "*">;
};

function evaluate(input: Input, id: string): number {
    const children = Object.keys(input.parentMap).filter((child) => input.parentMap[child] === id);
    if (children.length === 0) {
        return input.values[id] ?? 0;
    }
    const parts = children.map((child) => evaluate(input, child));
    return (input.ops[id] ?? "+") === "+"
        ? parts.reduce((a, b) => a + b, 0)
        : parts.reduce((a, b) => a * b, 1);
}

function checkFrames(frames: VisualFrame[], maxNodes: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.length).toBeLessThanOrEqual(maxNodes);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Tree Contraction (Rake and Compress)", () => {
    it("evaluates the default expression tree correctly", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, Object.keys(input.values).length);
        expect(frames[frames.length - 1]?.meta["result"]).toBe(evaluate(input, "A"));
    });

    it("matches recursive evaluation on random expression trees", () => {
        for (let trial = 0; trial < 14; trial += 1) {
            const parentMap: Record<string, string | null> = { B: "A", C: "A" };
            const values: Record<string, number> = { A: 0, B: 0, C: 0 };
            const ops: Record<string, "+" | "*"> = {
                A: Math.random() < 0.5 ? "+" : "*",
                B: Math.random() < 0.5 ? "+" : "*",
                C: Math.random() < 0.5 ? "+" : "*",
            };
            const leaves = ["D", "E", "F", "G"];
            leaves.forEach((leaf, i) => {
                parentMap[leaf] = i < 2 ? "B" : "C";
                values[leaf] = 1 + Math.floor(Math.random() * 6);
            });
            const input: Input = { parentMap, values, ops };
            const frames = [...mod.run(input)];
            expect(frames[frames.length - 1]?.meta["result"]).toBe(evaluate(input, "A"));
            expect(Number(frames[frames.length - 1]?.meta["rounds"])).toBeLessThan(5);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
