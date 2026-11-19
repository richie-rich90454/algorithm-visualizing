/**
 * logoot.test.ts - Convergence, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./logoot";
import type { VisualFrame } from "@/types";

interface Op {
    type: "insert" | "delete";
    pos: number[];
    site: string;
    char: string;
}

/** Independent Logoot replica used to test convergence under different orders. */
function converge(operations: Op[]): string {
    const elements: Array<{ pos: number[]; site: string; char: string }> = [];
    const cmp = (a: { pos: number[]; site: string }, b: { pos: number[]; site: string }) => {
        for (let i = 0; i < Math.max(a.pos.length, b.pos.length); i += 1) {
            const av = a.pos[i] ?? 0;
            const bv = b.pos[i] ?? 0;
            if (av !== bv) {
                return av - bv;
            }
        }
        return a.site < b.site ? -1 : a.site > b.site ? 1 : 0;
    };
    for (const op of operations) {
        const id = `${op.pos.join(".")}@${op.site}`;
        const find = () => elements.findIndex((e) => `${e.pos.join(".")}@${e.site}` === id);
        if (op.type === "delete") {
            const at = find();
            if (at >= 0) {
                elements.splice(at, 1);
            }
        } else {
            elements.push({ pos: op.pos.slice(), site: op.site, char: op.char });
        }
        elements.sort(cmp);
    }
    return elements.map((element) => element.char).join("");
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.every((entity) => entity.type === "character")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Logoot Sequence CRDT", () => {
    it("converges to the same sequence under different delivery orders", () => {
        const input = mod.defaultInput as { operations: Op[] };
        const ops = input.operations;
        const orderA = ops;
        const orderB = [ops[1], ops[3], ops[0], ops[2], ops[4]] as Op[];
        expect(converge(orderA)).toBe(converge(orderB));
        expect(converge(orderA)).toBe("dcb");
    });

    it("reports a final sequence that matches the independent replay", () => {
        const input = mod.defaultInput as { operations: Op[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["sequence"]).toBe(converge(input.operations));
        expect(last?.["length"]).toBe(3);
        expect(last?.["sequence"]).toBe("dcb");
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
