/**
 * crdt-or-set.test.ts - Independent OR-set reference, convergence properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./crdt-or-set";
import type { VisualFrame } from "@/types";

interface Op {
    replica?: number;
    op?: "add" | "remove";
    value?: string;
}

interface St {
    adds: Map<string, Set<string>>;
    tombs: Map<string, Set<string>>;
    counter: number;
}

const empty = (): St => ({ adds: new Map(), tombs: new Map(), counter: 0 });

/** Independent OR-set operation semantics. */
function apply(states: St[], op: Op): void {
    const r = Math.max(0, Math.min(1, Math.floor(op.replica ?? 0)));
    const value = op.value ?? "x";
    const st = states[r]!;
    if (op.op === "remove") {
        const visible = [...(st.adds.get(value) ?? [])].filter((t) => !(st.tombs.get(value) ?? new Set()).has(t));
        if (!st.tombs.has(value)) st.tombs.set(value, new Set());
        for (const tag of visible) st.tombs.get(value)!.add(tag);
    } else {
        st.counter += 1;
        const tag = `r${r}c${st.counter}`;
        if (!st.adds.has(value)) st.adds.set(value, new Set());
        st.adds.get(value)!.add(tag);
    }
}

/** Independent union merge. */
function mergeRef(a: St, b: St): St {
    const out = empty();
    const values = new Set([...a.adds.keys(), ...b.adds.keys(), ...a.tombs.keys(), ...b.tombs.keys()]);
    for (const v of values) {
        out.adds.set(v, new Set([...(a.adds.get(v) ?? []), ...(b.adds.get(v) ?? [])]));
        out.tombs.set(v, new Set([...(a.tombs.get(v) ?? []), ...(b.tombs.get(v) ?? [])]));
    }
    return out;
}

function visible(st: St, v: string): boolean {
    return [...(st.adds.get(v) ?? [])].some((t) => !(st.tombs.get(v) ?? new Set()).has(t));
}

function referenceElements(ops: Op[]): string[] {
    const states = [empty(), empty()];
    for (const op of ops) apply(states, op);
    const merged = mergeRef(states[0]!, states[1]!);
    const values: string[] = [];
    for (const op of ops) {
        const v = op.value ?? "x";
        if (!values.includes(v)) values.push(v);
    }
    return values.filter((v) => visible(merged, v)).sort();
}

function checkFrames(frames: VisualFrame[], opCount: number, valueCount: number): void {
    expect(frames.length).toBe(opCount + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["cols"]).toBe(3);
        expect(frame.meta["rows"]).toBe(valueCount);
        expect(frame.entities.length).toBe(3 * valueCount);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("CrdtOrSet", () => {
    it("matches an independent OR-set reference on several operation logs", () => {
        const cases: Op[][] = [
            (mod.defaultInput as { ops: Op[] }).ops,
            [
                { replica: 0, op: "add", value: "x" },
                { replica: 1, op: "add", value: "x" },
                { replica: 0, op: "remove", value: "x" },
            ],
            [
                { replica: 0, op: "add", value: "a" },
                { replica: 1, op: "remove", value: "a" },
                { replica: 1, op: "add", value: "a" },
                { replica: 0, op: "remove", value: "a" },
            ],
            [
                { replica: 1, op: "add", value: "p" },
                { replica: 1, op: "add", value: "q" },
                { replica: 0, op: "add", value: "q" },
                { replica: 0, op: "remove", value: "q" },
                { replica: 1, op: "remove", value: "p" },
            ],
        ];
        for (const ops of cases) {
            const frames = [...mod.run({ ops })];
            const values = Array.from(new Set(ops.map((o) => o.value ?? "x")));
            checkFrames(frames, ops.length, values.length);
            const final = frames[frames.length - 1]?.meta["elements"] as string[];
            expect([...final].sort()).toEqual(referenceElements(ops));
            expect(frames[frames.length - 1]?.meta["converged"]).toBe(true);
        }
    });

    it("converges: the final replica columns equal the merged column", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]!;
        const states = [0, 1, 2].map((c) =>
            final.entities.filter((e) => e.metadata["col"] === c).map((e) => e.metadata["present"]),
        );
        expect(states[0]).toEqual(states[2]);
        expect(states[1]).toEqual(states[2]);
    });

    it("merge algebra is commutative, associative, and idempotent", () => {
        const a = empty();
        const b = empty();
        const c = empty();
        apply([a], { replica: 0, op: "add", value: "k" });
        apply([b], { replica: 0, op: "add", value: "k" });
        apply([b], { replica: 0, op: "remove", value: "k" });
        apply([c], { replica: 0, op: "add", value: "k" });
        const key = (s: St) => [...s.adds.entries()].filter(([, t]) => t.size > 0).sort().map(([v, tags]) => `${v}:${[...tags].sort().join(",")}`).join("|")
            + "#" + [...s.tombs.entries()].filter(([, t]) => t.size > 0).sort().map(([v, tags]) => `${v}:${[...tags].sort().join(",")}`).join("|");
        expect(key(mergeRef(a, b))).toBe(key(mergeRef(b, a)));
        expect(key(mergeRef(mergeRef(a, b), c))).toBe(key(mergeRef(a, mergeRef(b, c))));
        expect(key(mergeRef(a, a))).toBe(key(a));
    });

    it("a concurrent add survives a remove that never observed it", () => {
        const frames = [...mod.run({ ops: [
            { replica: 0, op: "add", value: "b" },
            { replica: 1, op: "add", value: "b" },
            { replica: 0, op: "remove", value: "b" },
        ] })];
        const final = frames[frames.length - 1]?.meta["elements"] as string[];
        expect(final).toEqual(["b"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6 + 2);
        expect(generator.next().done).toBe(true);
    });
});
