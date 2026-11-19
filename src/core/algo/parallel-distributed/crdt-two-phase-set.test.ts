/**
 * crdt-two-phase-set.test.ts - Independent 2P-set reference, convergence, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./crdt-two-phase-set";
import type { VisualFrame } from "@/types";

interface Op {
    replica?: number;
    op?: "add" | "remove";
    value?: string;
}

interface St {
    adds: Set<string>;
    removes: Set<string>;
}

const empty = (): St => ({ adds: new Set(), removes: new Set() });

function applyRef(states: St[], op: Op): void {
    const r = Math.max(0, Math.min(1, Math.floor(op.replica ?? 0)));
    const v = op.value ?? "x";
    const st = states[r]!;
    if (op.op === "remove") {
        st.removes.add(v);
        st.adds.delete(v);
    } else if (!st.removes.has(v)) {
        st.adds.add(v);
    }
}

function mergeRef(a: St, b: St): St {
    const out = empty();
    for (const v of a.adds) out.adds.add(v);
    for (const v of b.adds) out.adds.add(v);
    for (const v of a.removes) out.removes.add(v);
    for (const v of b.removes) out.removes.add(v);
    for (const v of out.removes) out.adds.delete(v);
    return out;
}

function reference(ops: Op[]): string[] {
    const states = [empty(), empty()];
    for (const op of ops) applyRef(states, op);
    const merged = mergeRef(states[0]!, states[1]!);
    return [...merged.adds].sort();
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.length).toBe(3 * (frame.meta["rows"] as number));
        for (const e of frame.entities) expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
        expect(frame.edges).toEqual([]);
    });
}

describe("CrdtTwoPhaseSet", () => {
    it("matches an independent 2P-set reference on several operation logs", () => {
        const cases: Op[][] = [
            (mod.defaultInput as { ops: Op[] }).ops,
            [
                { replica: 0, op: "add", value: "a" },
                { replica: 1, op: "remove", value: "a" },
                { replica: 1, op: "add", value: "a" },
            ],
            [
                { replica: 0, op: "add", value: "x" },
                { replica: 0, op: "add", value: "y" },
                { replica: 1, op: "remove", value: "x" },
                { replica: 1, op: "add", value: "z" },
            ],
        ];
        for (const ops of cases) {
            const frames = [...mod.run({ ops })];
            checkFrames(frames);
            const final = frames.at(-1)!;
            expect([...(final.meta["elements"] as string[])].sort()).toEqual(reference(ops));
            expect(final.meta["converged"]).toBe(true);
        }
    });

    it("remove wins a concurrent add and a removed element is never re-added", () => {
        const frames = [...mod.run({ ops: [
            { replica: 0, op: "add", value: "b" },
            { replica: 1, op: "remove", value: "b" },
            { replica: 1, op: "add", value: "b" },
        ] })];
        expect(frames.at(-1)!.meta["elements"]).toEqual([]);
    });

    it("merge is commutative, associative, and idempotent", () => {
        const a = empty();
        const b = empty();
        const c = empty();
        applyRef([a], { op: "add", value: "k" });
        applyRef([b], { op: "add", value: "k" });
        applyRef([b], { op: "remove", value: "k" });
        applyRef([c], { op: "add", value: "m" });
        const key = (s: St) => `${[...s.adds].sort().join(",")}|${[...s.removes].sort().join(",")}`;
        expect(key(mergeRef(a, b))).toBe(key(mergeRef(b, a)));
        expect(key(mergeRef(mergeRef(a, b), c))).toBe(key(mergeRef(a, mergeRef(b, c))));
        expect(key(mergeRef(a, a))).toBe(key(a));
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe((mod.defaultInput as { ops: Op[] }).ops.length + 2);
        expect(gen.next().done).toBe(true);
    });
});
