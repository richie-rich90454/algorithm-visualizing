/**
 * crdt-rga-sequence.test.ts - Independent tree reference, convergence over all
 * valid delivery orders, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./crdt-rga-sequence";
import type { VisualFrame } from "@/types";

interface Op { site: number; counter: number; after: number | null; char: string }

const canonical: Op[] = [
    { site: 0, counter: 0, after: null, char: "a" },
    { site: 1, counter: 0, after: 0, char: "b" },
    { site: 1, counter: 1, after: 0, char: "c" },
    { site: 0, counter: 1, after: 1, char: "d" },
    { site: 2, counter: 0, after: 2, char: "e" },
];

const idOf = (op: Op) => `${op.site}-${op.counter}`;

/** Independent reference using a recursive render over an id-keyed child map. */
function reference(ops: Op[]): string {
    const ids = ops.map(idOf);
    const children = new Map<string, string[]>([["root", []]]);
    const labels = new Map<string, string>([["root", ""]]);
    ops.forEach((op, i) => {
        const parent = op.after === null ? "root" : ids[op.after]!;
        if (!children.has(parent)) {
            children.set(parent, []);
        }
        children.get(parent)!.push(ids[i]!);
        labels.set(ids[i]!, op.char);
    });
    for (const list of children.values()) {
        list.sort((a, b) => {
            const [as, ac] = a.split("-").map(Number);
            const [bs, bc] = b.split("-").map(Number);
            return ac! !== bc! ? bc! - ac! : bs! - as!;
        });
    }
    const out: string[] = [];
    const visit = (id: string) => {
        if (id !== "root") {
            out.push(labels.get(id) ?? "?");
        }
        for (const child of children.get(id) ?? []) {
            visit(child);
        }
    };
    visit("root");
    return out.join("");
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(frame.entities.length).toBe(Number(frame.meta["length"]));
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** All permutations of indices, used to enumerate delivery orders. */
function permutations(values: number[]): number[][] {
    if (values.length <= 1) {
        return [values];
    }
    const result: number[][] = [];
    values.forEach((value, i) => {
        const rest = values.slice(0, i).concat(values.slice(i + 1));
        for (const tail of permutations(rest)) {
            result.push([value, ...tail]);
        }
    });
    return result;
}

describe("CausalRGA", () => {
    it("matches an independent recursive tree renderer", () => {
        const frames = [...mod.run({ operations: canonical })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["sequence"]).toBe(reference(canonical));
        expect(final?.["sequence"]).toBe("acebd");
    });

    it("converges for every parent-before-child delivery order", () => {
        const expected = reference(canonical);
        let checked = 0;
        for (const order of permutations(canonical.map((_, i) => i))) {
            const position = new Map(order.map((original, index) => [original, index]));
            const valid = canonical.every((op, i) => op.after === null || position.get(op.after)! < position.get(i)!);
            if (!valid) {
                continue;
            }
            const permuted = order.map((original) => {
                const op = canonical[original]!;
                return {
                    ...op,
                    after: op.after === null ? null : position.get(op.after)!,
                };
            });
            const frames = [...mod.run({ operations: permuted })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["sequence"]).toBe(expected);
            checked += 1;
        }
        expect(checked).toBeGreaterThan(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run({ operations: canonical });
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
