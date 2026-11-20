/** enhanced-clock-page-replacement.test.ts - Reference replay, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./enhanced-clock-page-replacement";
import type { VisualFrame } from "@/types";

interface FrameState {
    page: number;
    referenced: number;
    modified: number;
}
const cls = (f: FrameState): number => f.referenced * 2 + f.modified;

/** Independent replay of enhanced CLOCK used as an oracle. */
function reference(capacity: number, requests: number[], writes: Set<number>) {
    const frames: Array<FrameState | null> = new Array(capacity).fill(null);
    let hand = 0;
    let hits = 0;
    let faults = 0;
    for (let i = 0; i < requests.length; i += 1) {
        const page = requests[i] as number;
        const at = frames.findIndex((f) => f?.page === page);
        if (at >= 0) {
            const f = frames[at] as FrameState;
            f.referenced = 1;
            if (writes.has(page)) f.modified = 1;
            hits += 1;
            continue;
        }
        faults += 1;
        const free = frames.findIndex((f) => f === null);
        if (free >= 0) {
            frames[free] = { page, referenced: 1, modified: writes.has(page) ? 1 : 0 };
            hand = (free + 1) % capacity;
            continue;
        }
        let victim = -1;
        let best = 4;
        let scanned = 0;
        while (scanned < 2 * capacity) {
            const f = frames[hand] as FrameState;
            const c = cls(f);
            if (c < best) {
                best = c;
                victim = hand;
            }
            if (f.referenced === 1) f.referenced = 0;
            hand = (hand + 1) % capacity;
            scanned += 1;
            if (best === 0) break;
        }
        frames[victim] = { page, referenced: 1, modified: writes.has(page) ? 1 : 0 };
        hand = (victim + 1) % capacity;
    }
    return { hits, faults, frames: frames.map((f) => (f ? `${f.page}:${f.referenced}${f.modified}` : "-")) };
}

const finalMeta = (frames: VisualFrame[]): VisualFrame["meta"] => (frames[frames.length - 1] as VisualFrame).meta;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("Enhanced CLOCK page replacement", () => {
    it("matches an independent replay on many request streams", () => {
        const random = rng(13579);
        for (let trial = 0; trial < 120; trial += 1) {
            const capacity = 1 + Math.floor(random() * 5);
            const length = 5 + Math.floor(random() * 30);
            const requests: number[] = [];
            const writes: number[] = [];
            for (let i = 0; i < length; i += 1) {
                const page = Math.floor(random() * 8);
                requests.push(page);
                if (random() < 0.3) writes.push(page);
            }
            const frames = [...mod.run({ capacity, requests, writes })];
            checkFrames(frames);
            const meta = finalMeta(frames);
            const expected = reference(capacity, requests, new Set(writes));
            expect(meta["hits"]).toBe(expected.hits);
            expect(meta["faults"]).toBe(expected.faults);
            expect(meta["frames"]).toEqual(expected.frames);
            expect((meta["hits"] as number) + (meta["faults"] as number)).toBe(length);
            expect((meta["frames"] as string[]).length).toBe(capacity);
        }
    });

    it("evicts a clean unreferenced page before a dirty referenced one", () => {
        const frames = [...mod.run({ capacity: 2, requests: [1, 2, 3], writes: [2] })];
        expect(finalMeta(frames)["faults"]).toBe(3);
        expect(finalMeta(frames)["frames"]).toContain("3:10");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(generator.next().done).toBe(true);
    });
});
