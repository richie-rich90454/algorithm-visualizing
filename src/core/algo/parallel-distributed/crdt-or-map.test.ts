/**
 * crdt-or-map.test.ts - Independent OR-map merge, commutativity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./crdt-or-map";
import type { VisualFrame } from "@/types";

interface Op {
    type: "add" | "remove";
    key: string;
    value?: string;
    tag?: string;
}

interface State {
    adds: Map<string, string>;
    removes: Set<string>;
}

type Rep = Map<string, State>;

function stateOf(rep: Rep, key: string): State {
    let s = rep.get(key);
    if (!s) {
        s = { adds: new Map(), removes: new Set() };
        rep.set(key, s);
    }
    return s;
}

function independentApply(rep: Rep, ops: Op[], prefix: string): void {
    ops.forEach((op, i) => {
        const s = stateOf(rep, op.key);
        if (op.type === "remove") {
            for (const tag of s.adds.keys()) {
                s.removes.add(tag);
            }
        } else {
            s.adds.set(typeof op.tag === "string" ? op.tag : `${prefix}${i}`, op.value ?? "");
        }
    });
}

function independentMerge(a: Rep, b: Rep): Rep {
    const out: Rep = new Map();
    for (const [key, value] of [...a, ...b]) {
        const s = stateOf(out, key);
        for (const [tag, val] of value.adds) {
            s.adds.set(tag, val);
        }
        for (const tag of value.removes) {
            s.removes.add(tag);
        }
    }
    return out;
}

function independentVisible(rep: Rep, keys: string[]): Record<string, string | null> {
    const result: Record<string, string | null> = {};
    for (const key of keys) {
        const s = rep.get(key);
        let bestTag: string | null = null;
        let bestValue: string | null = null;
        if (s) {
            for (const [tag, value] of s.adds) {
                if (!s.removes.has(tag) && (bestTag === null || tag > bestTag)) {
                    bestTag = tag;
                    bestValue = value;
                }
            }
        }
        result[key] = bestValue;
    }
    return result;
}

function checkFrames(frames: VisualFrame[], keys: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(keys);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function finalVisible(opsA: Op[], opsB: Op[], keys: string[]): Record<string, string | null> {
    const frames = [...mod.run({ opsA, opsB, keys })];
    checkFrames(frames, keys.length);
    return JSON.parse(String(frames[frames.length - 1]?.meta["visibleJson"])) as Record<string, string | null>;
}

describe("OR-map CRDT", () => {
    it("matches an independent add-wins merge across several operation sets", () => {
        const cases: Array<{ opsA: Op[]; opsB: Op[] }> = [
            {
                opsA: [
                    { type: "add", key: "color", value: "red", tag: "A0" },
                    { type: "add", key: "size", value: "10", tag: "A1" },
                ],
                opsB: [
                    { type: "remove", key: "color" },
                    { type: "add", key: "size", value: "20", tag: "B1" },
                ],
            },
            {
                opsA: [{ type: "add", key: "k", value: "1", tag: "z" }],
                opsB: [{ type: "add", key: "k", value: "2", tag: "a" }],
            },
            {
                opsA: [
                    { type: "add", key: "k", value: "v1", tag: "a" },
                    { type: "remove", key: "k" },
                ],
                opsB: [{ type: "add", key: "k", value: "v2", tag: "b" }],
            },
        ];
        const keys = ["color", "size", "k"];
        for (const { opsA, opsB } of cases) {
            const a: Rep = new Map();
            const b: Rep = new Map();
            independentApply(a, opsA, "A");
            independentApply(b, opsB, "B");
            const want = independentVisible(independentMerge(a, b), keys);
            expect(finalVisible(opsA, opsB, keys)).toEqual(want);
        }
    });

    it("merges commutatively regardless of replica order", () => {
        const opsA: Op[] = [
            { type: "add", key: "color", value: "red", tag: "A0" },
            { type: "add", key: "size", value: "10", tag: "A1" },
        ];
        const opsB: Op[] = [
            { type: "remove", key: "color" },
            { type: "add", key: "size", value: "20", tag: "B1" },
        ];
        const keys = ["color", "size"];
        expect(finalVisible(opsA, opsB, keys)).toEqual(finalVisible(opsB, opsA, keys));
    });

    it("keeps a concurrent add when another replica removes", () => {
        const visible = finalVisible(
            [{ type: "add", key: "k", value: "survives", tag: "A0" }],
            [{ type: "remove", key: "k" }],
            ["k"],
        );
        expect(visible["k"]).toBe("survives");
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
