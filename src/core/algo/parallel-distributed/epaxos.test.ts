/**
 * epaxos.test.ts - Fast-path classification and total-order property checks.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateEPaxos, type Command } from "./epaxos";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent reference: earliest command per key is the only fast one. */
function reference(commands: Command[]) {
    const fast = commands.map((_, i) =>
        !commands.some((o, j) => j !== i && o.key === commands[i]?.key &&
            (o.seq < (commands[i]?.seq ?? 0) ||
                (o.seq === commands[i]?.seq && j < i))),
    );
    const order = commands.map((_, i) => i).sort((a, b) => {
        const ca = commands[a];
        const cb = commands[b];
        return (ca?.seq ?? 0) - (cb?.seq ?? 0) ||
            (ca?.key ?? "").localeCompare(cb?.key ?? "") || a - b;
    });
    return { fast, order };
}

describe("EPaxos", () => {
    it("matches an independent classifier on exhaustive small command sets", () => {
        const keys = ["x", "y"];
        const seqs = [1, 2];
        let checked = 0;
        for (let n = 1; n <= 5; n += 1) {
            for (let trial = 0; trial < 60; trial += 1) {
                const commands: Command[] = Array.from({ length: n }, (_, i) => ({
                    id: `c${i}`,
                    key: keys[(trial + i) % keys.length] ?? "x",
                    seq: seqs[(trial * 2 + i) % seqs.length] ?? 1,
                }));
                const expected = reference(commands);
                const data = simulateEPaxos(commands);
                expect(data.fast).toEqual(expected.fast);
                expect(data.order).toEqual(expected.order);
                expect(new Set(data.order).size).toBe(n);
                checked += 1;
            }
        }
        expect(checked).toBeGreaterThan(200);
    });

    it("keeps exactly the first command of each key on the fast path", () => {
        const commands: Command[] = [
            { id: "a", key: "x", seq: 1 },
            { id: "b", key: "x", seq: 1 },
            { id: "c", key: "y", seq: 2 },
            { id: "d", key: "y", seq: 3 },
        ];
        const data = simulateEPaxos(commands);
        expect(data.fast).toEqual([true, false, true, false]);
        const frames = [...mod.run({ commands })];
        checkFrames(frames, commands.length);
        expect(frames[frames.length - 1]?.meta["order"]).toEqual(data.order);
    });

    it("produces well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 4);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
