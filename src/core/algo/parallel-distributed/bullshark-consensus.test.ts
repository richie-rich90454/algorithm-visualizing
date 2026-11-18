/**
 * bullshark-consensus.test.ts - Independent quorum-reference check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bullshark-consensus";
import type { VisualFrame } from "@/types";

interface Input {
    nodes: number;
    crash: number | number[];
    value: string;
    coin: number;
    maxWaves: number;
}

/** Independent replica/wave model of the Bullshark decision rule. */
function reference(input: Input) {
    const n = input.nodes <= 4 ? 4 : 7;
    const f = Math.floor((n - 1) / 3);
    const quorum = 2 * f + 1;
    const crashList = typeof input.crash === "number" ? (input.crash >= 0 ? [input.crash] : []) : input.crash;
    const crashed = new Set(crashList.filter((i) => i >= 0 && i < n).map(Math.floor));
    const alive = Array.from({ length: n }, (_, i) => i).filter((i) => !crashed.has(i));
    if (alive.length < quorum) {
        return { decided: false, n, f, quorum, wave: 0 };
    }
    for (let wave = 1; wave <= input.maxWaves; wave += 1) {
        const leader = alive[(input.coin + wave - 1) % alive.length]!;
        const votes = alive.length;
        if (votes >= quorum) {
            return { decided: true, n, f, quorum, wave, value: input.value };
        }
    }
    return { decided: false, n, f, quorum, wave: input.maxWaves };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["quorum"]).toBe(2 * (frame.meta["f"] as number) + 1);
    });
}

describe("BullsharkConsensus", () => {
    it("matches an independent quorum reference across cluster and crash settings", () => {
        const cases: Input[] = [
            { nodes: 4, crash: -1, value: "v1", coin: 0, maxWaves: 2 },
            { nodes: 4, crash: 0, value: "v2", coin: 1, maxWaves: 2 },
            { nodes: 4, crash: [0, 1], value: "v3", coin: 0, maxWaves: 2 },
            { nodes: 7, crash: -1, value: "v4", coin: 2, maxWaves: 3 },
            { nodes: 7, crash: [0, 1], value: "v5", coin: 3, maxWaves: 3 },
            { nodes: 7, crash: [0, 1, 2], value: "v6", coin: 0, maxWaves: 3 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            checkFrames(frames, expected.n);
            expect(final?.["n"]).toBe(expected.n);
            expect(final?.["f"]).toBe(expected.f);
            expect(final?.["quorum"]).toBe(expected.quorum);
            expect(final?.["decided"]).toBe(expected.decided);
            if (expected.decided) {
                expect(final?.["value"]).toBe(expected.value);
                expect(final?.["wave"]).toBe(expected.wave);
            }
        }
    });

    it("two quorums always overlap in at least one live replica", () => {
        for (const n of [4, 7]) {
            const f = Math.floor((n - 1) / 3);
            const quorum = 2 * f + 1;
            for (let a = 0; a < n; a += 1) {
                for (let b = 0; b < n; b += 1) {
                    const qa = Array.from({ length: quorum }, (_, k) => (a + k) % n);
                    const qb = Array.from({ length: quorum }, (_, k) => (b + k) % n);
                    expect(qa.some((x) => qb.includes(x))).toBe(true);
                }
            }
        }
    });

    it("stalls when fewer than a quorum of replicas are alive", () => {
        const frames = [...mod.run({ nodes: 4, crash: [0, 1], value: "v", coin: 0, maxWaves: 3 })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["decided"]).toBe(false);
        expect(final?.["alive"]).toBeLessThan(final?.["quorum"] as number);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
