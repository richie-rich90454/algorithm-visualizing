/**
 * dotted-version-vector.test.ts - Set-union reference, algebraic laws, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./dotted-version-vector";
import type { VisualFrame } from "@/types";

type History = Record<string, number[]>;
type Replica = { actor: string; counters: number[] };

function referenceMerge(a: History, b: History): History {
    const result: History = {};
    for (const actor of new Set([...Object.keys(a), ...Object.keys(b)])) {
        result[actor] = [...new Set([...(a[actor] ?? []), ...(b[actor] ?? [])])].sort((x, y) => x - y);
    }
    return result;
}

function referenceCompress(counters: number[]): { version: number; dots: number[] } {
    const present = new Set(counters);
    let version = 0;
    while (present.has(version + 1)) version += 1;
    return { version, dots: counters.filter((c) => c > version).sort((a, b) => a - b) };
}

function checkFrames(frames: VisualFrame[], replicaCount: number): void {
    expect(frames.length).toBe(replicaCount + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect((frame.meta["actors"] as string[]).length).toBeGreaterThan(0);
        expect((frame.meta["versions"] as number[]).length).toBe((frame.meta["actors"] as string[]).length);
    });
}

describe("DottedVersionVector", () => {
    it("merges to the exact set union of replica counters", () => {
        const replicas: Replica[] = [
            { actor: "A", counters: [1, 2, 3] },
            { actor: "B", counters: [1, 3] },
            { actor: "A", counters: [1, 2] },
            { actor: "B", counters: [1, 2, 4] },
        ];
        const frames = [...mod.run({ replicas })];
        checkFrames(frames, replicas.length);
        const final = frames[frames.length - 1]?.meta;
        let expected: History = {};
        for (const replica of replicas) expected = referenceMerge(expected, { [replica.actor]: replica.counters });
        const actors = final?.["actors"] as string[];
        const versions = final?.["versions"] as number[];
        actors.forEach((actor, i) => {
            const compressed = referenceCompress(expected[actor] ?? []);
            expect(versions[i]).toBe(compressed.version);
            expect((final?.["dots"] as string[])[i]).toBe(compressed.dots.join(","));
        });
    });

    it("satisfies commutativity, associativity, and idempotence", () => {
        const final = [...mod.run(mod.defaultInput)].pop()?.meta;
        expect(final?.["commutative"]).toBe(true);
        expect(final?.["associative"]).toBe(true);
        expect(final?.["idempotent"]).toBe(true);
    });

    it("keeps a gap as an explicit dot until it is filled", () => {
        const frames = [...mod.run({ replicas: [
            { actor: "A", counters: [1, 3] },
            { actor: "B", counters: [1] },
        ] })];
        checkFrames(frames, 2);
        const final = frames[frames.length - 1]?.meta;
        const actors = final?.["actors"] as string[];
        const index = actors.indexOf("A");
        expect((final?.["versions"] as number[])[index]).toBe(1);
        expect((final?.["dots"] as string[])[index]).toBe("3");
        expect(final?.["dotCount"]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
