/**
 * log-structured-broadcast.test.ts - Independent log convergence, ordering,
 * monotonic growth, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { messageKey } from "./log-structured-broadcast";
import type { VisualFrame } from "@/types";

type Message = { source: number; seq: number; payload: string };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Number(frame.meta["rows"])).toBeGreaterThan(0);
        expect(Number(frame.meta["cols"])).toBeGreaterThanOrEqual(0);
        for (const entity of frame.entities) expect(entity.type).toBe("cell");
    });
}

/** Reconstruct each node's ordered log from a frame's cells. */
function logsFromFrame(frame: VisualFrame, nodes: number, keys: string[]): Set<string>[] {
    const logs: Set<string>[] = Array.from({ length: nodes }, () => new Set<string>());
    for (const entity of frame.entities) {
        if (entity.metadata["present"] === true) {
            const row = Number(entity.metadata["row"]);
            const col = Number(entity.metadata["col"]);
            (logs[row] as Set<string>).add(keys[col] as string);
        }
    }
    return logs;
}

function seeded(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 69069 + 1) >>> 0;
        return s / 0x100000000;
    };
}

describe("LogStructuredBroadcast", () => {
    it("converges every node to the globally ordered message set", () => {
        const rand = seeded(97);
        for (let trial = 0; trial < 50; trial += 1) {
            const nodes = 2 + Math.floor(rand() * 4);
            const messages: Message[] = [];
            const used = new Set<string>();
            const count = 3 + Math.floor(rand() * 6);
            for (let i = 0; i < count; i += 1) {
                const m = { source: Math.floor(rand() * nodes), seq: Math.floor(rand() * 3), payload: `m${i}` };
                const key = messageKey(m);
                if (used.has(key)) continue;
                used.add(key);
                messages.push(m);
            }
            const rounds: Array<[number, number]> = [];
            for (let i = 0; i + 1 < nodes; i += 1) rounds.push([i, i + 1]);
            for (let i = nodes - 1; i > 0; i -= 1) rounds.push([i, i - 1]);
            const frames = [...mod.run({ nodes, messages, rounds })];
            checkFrames(frames);
            const keys = (frames[0]?.meta["keys"] as string[]) ?? [];
            const expected = messages.slice().sort((a, b) => a.source - b.source || a.seq - b.seq).map(messageKey);
            expect(keys).toEqual(expected);
            const finalLogs = logsFromFrame(frames[frames.length - 1] as VisualFrame, nodes, keys);
            for (const log of finalLogs) expect([...log].sort()).toEqual([...expected].sort());
        }
    });

    it("only grows logs and keeps records ordered by source then sequence", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const keys = frames[0]?.meta["keys"] as string[];
        let previous = logsFromFrame(frames[0] as VisualFrame, 4, keys);
        for (let i = 1; i < frames.length; i += 1) {
            const current = logsFromFrame(frames[i] as VisualFrame, 4, keys);
            for (let p = 0; p < 4; p += 1) {
                for (const key of previous[p] as Set<string>) expect((current[p] as Set<string>).has(key)).toBe(true);
            }
            previous = current;
        }
        const messages = (frames[0]?.meta["messages"] as string[]).map((s) => {
            const [source, seq] = s.split(":");
            return { source: Number(source), seq: Number(seq) };
        });
        for (let i = 1; i < messages.length; i += 1) {
            const prev = messages[i - 1] as Message;
            const curr = messages[i] as Message;
            expect(prev.source < curr.source || (prev.source === curr.source && prev.seq <= curr.seq)).toBe(true);
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
