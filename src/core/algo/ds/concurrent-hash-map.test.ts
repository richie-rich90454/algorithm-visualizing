/**
 * concurrent-hash-map.test.ts - Independent striped-lock reference, frame
 * shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./concurrent-hash-map";
import type { VisualFrame } from "@/types";

type Op = { op: "put" | "get" | "remove"; key: number; value?: number };

function hash(key: number): number {
    let h = (Math.imul(key ^ 0x5bd1e995, 0x27d4eb2d) ^ (key >>> 3)) >>> 0;
    h ^= h >>> 15;
    return h >>> 0;
}

/** Independent striped-lock simulator using a plain Map. */
function reference(buckets: number, stripes: number, threads: Op[][]) {
    const map = new Map<number, number>();
    const locks: Array<number | null> = Array.from({ length: stripes }, () => null);
    const cursor = threads.map(() => 0);
    let acquisitions = 0;
    let blocks = 0;
    let rounds = 0;

    while (cursor.some((c, i) => c < (threads[i]?.length ?? 0)) && rounds < 1000) {
        rounds += 1;
        for (let t = 0; t < threads.length; t += 1) {
            const ops = threads[t] ?? [];
            const index = cursor[t] ?? 0;
            if (index >= ops.length) {
                continue;
            }
            const op = ops[index] as Op;
            const stripe = hash(op.key) % stripes;
            const owner = locks[stripe] ?? null;
            if (owner !== null && owner !== t) {
                blocks += 1;
                continue;
            }
            const acquired = owner === null;
            if (acquired) {
                locks[stripe] = t;
                acquisitions += 1;
            }
            if (op.op === "put") {
                map.set(op.key, op.value ?? 0);
            } else if (op.op === "remove") {
                map.delete(op.key);
            }
            if (acquired) {
                locks[stripe] = null;
            }
            cursor[t] = index + 1;
        }
    }
    return { content: [...map.entries()].map(([k, v]) => `${k}=${v}`).sort(), acquisitions, blocks };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const content = frame.meta["content"];
        expect(Array.isArray(content)).toBe(true);
        if (Array.isArray(content)) {
            expect(new Set(content).size).toBe(content.length);
        }
    });
}

describe("Concurrent Hash Map (Lock Striping)", () => {
    it("matches an independent striped-lock reference", () => {
        const input = mod.defaultInput as {
            buckets: number;
            stripes: number;
            threads: Array<{ ops: Op[] }>;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        const want = reference(input.buckets, input.stripes, input.threads.map((t) => t.ops));
        expect(last?.["content"]).toEqual(want.content);
        expect(last?.["acquisitions"]).toBe(want.acquisitions);
        expect(last?.["blocks"]).toBe(want.blocks);
    });

    it("agrees with the reference across different stripe counts and workloads", () => {
        const cases: Array<{ buckets: number; stripes: number; threads: Op[][] }> = [
            {
                buckets: 2,
                stripes: 1,
                threads: [
                    [{ op: "put", key: 0, value: 5 }, { op: "get", key: 0 }],
                    [{ op: "put", key: 1, value: 6 }, { op: "remove", key: 0 }],
                ],
            },
            {
                buckets: 4,
                stripes: 4,
                threads: [
                    [{ op: "put", key: 2, value: 20 }, { op: "put", key: 4, value: 40 }],
                    [{ op: "put", key: 3, value: 30 }, { op: "get", key: 2 }],
                ],
            },
            {
                buckets: 3,
                stripes: 2,
                threads: [
                    [{ op: "put", key: 1, value: 1 }, { op: "remove", key: 1 }, { op: "put", key: 1, value: 9 }],
                    [{ op: "put", key: 5, value: 50 }],
                ],
            },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({
                buckets: testCase.buckets,
                stripes: testCase.stripes,
                threads: testCase.threads.map((ops) => ({ ops })),
            })];
            checkFrames(frames);
            const last = frames[frames.length - 1]?.meta;
            const want = reference(testCase.buckets, testCase.stripes, testCase.threads);
            expect(last?.["content"]).toEqual(want.content);
            expect(last?.["acquisitions"]).toBe(want.acquisitions);
            expect(last?.["blocks"]).toBe(want.blocks);
        }
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
