/**
 * vector-timestamp-antichain.test.ts - Independent antichain replay, dominance
 * checks, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { dominates } from "./vector-timestamp-antichain";
import type { VisualFrame } from "@/types";

type Stamp = { label: string; vector: number[] };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Number(frame.meta["rows"])).toBeGreaterThan(0);
        expect(Number(frame.meta["cols"])).toBeGreaterThan(0);
        for (const entity of frame.entities) expect(entity.type).toBe("cell");
    });
}

/** Parse the serialized chain stored in frame meta. */
function parseChain(raw: string[] | undefined): number[][] {
    return (raw ?? []).map((s) => {
        const colon = s.indexOf(":");
        return s.slice(colon + 1).split(",").map(Number);
    });
}

/** Brute replay: recompute delivered, discarded, and the minimal antichain. */
function bruteReplay(events: Stamp[], processes: number) {
    const chain: number[][] = [];
    let delivered = 0;
    let discarded = 0;
    for (const event of events) {
        const v = Array.from({ length: processes }, (_, i) => event.vector[i] ?? 0);
        if (chain.some((e) => dominates(e, v))) {
            discarded += 1;
            continue;
        }
        delivered += 1;
        const survivors = chain.filter((e) => !dominates(v, e));
        survivors.push(v);
        chain.length = 0;
        chain.push(...survivors);
    }
    return { chain, delivered, discarded };
}

function seeded(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 214013 + 2531011) >>> 0;
        return s / 0x100000000;
    };
}

describe("VectorTimestampAntichain", () => {
    it("matches an independent replay for random event streams", () => {
        const rand = seeded(101);
        for (let trial = 0; trial < 60; trial += 1) {
            const processes = 2 + Math.floor(rand() * 3);
            const events: Stamp[] = Array.from({ length: 5 + Math.floor(rand() * 6) }, (_, i) => ({
                label: `m${i}`,
                vector: Array.from({ length: processes }, () => Math.floor(rand() * 4)),
            }));
            const frames = [...mod.run({ processes, events })];
            checkFrames(frames);
            const expected = bruteReplay(events, processes);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["delivered"]).toBe(expected.delivered);
            expect(final?.["discarded"]).toBe(expected.discarded);
            const finalChain = parseChain(final?.["chain"] as string[]);
            expect(finalChain).toEqual(expected.chain);
            for (let i = 0; i < finalChain.length; i += 1) {
                for (let j = i + 1; j < finalChain.length; j += 1) {
                    expect(dominates(finalChain[i] as number[], finalChain[j] as number[])).toBe(false);
                    expect(dominates(finalChain[j] as number[], finalChain[i] as number[])).toBe(false);
                }
            }
        }
    });

    it("keeps the default antichain minimal", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["delivered"]).toBe(3);
        expect(final?.["discarded"]).toBe(1);
        expect(final?.["chain"]).toEqual(["c:1,1,0"]);
        for (const frame of frames.filter((f) => f.meta["verdict"] === "deliver" || f.meta["verdict"] === "discard")) {
            const chain = parseChain(frame.meta["chain"] as string[]);
            for (let i = 0; i < chain.length; i += 1) {
                for (let j = 0; j < chain.length; j += 1) {
                    if (i !== j) expect(dominates(chain[i] as number[], chain[j] as number[])).toBe(false);
                }
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
