/**
 * double-hashing.test.ts - Independent table construction, full-cycle probe
 * property, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./double-hashing";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], buckets: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(buckets);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["buckets"]).toBe(buckets);
        expect((frame.meta["table"] as string[]).length).toBe(buckets);
    });
}

function home(key: string, m: number): number {
    let h = 0;
    for (const c of key) {
        h = (h * 31 + c.charCodeAt(0)) % m;
    }
    return h;
}

function stride(key: string, m: number): number {
    let h = 0;
    for (const c of key) {
        h = (h * 37 + c.charCodeAt(0)) % (m - 1);
    }
    return 1 + h;
}

/** Build the table from scratch with the specified double-hashing rules. */
function reference(keys: string[], m: number, probe: string) {
    const table: Array<string | null> = new Array<string | null>(m).fill(null);
    for (const key of keys) {
        const h = home(key, m);
        const s = stride(key, m);
        for (let i = 0; i < m; i += 1) {
            const slot = (h + i * s) % m;
            if (table[slot] === null) {
                table[slot] = key;
                break;
            }
        }
    }
    const h = home(probe, m);
    const s = stride(probe, m);
    const probeSequence: number[] = [];
    let found = false;
    for (let i = 0; i < m; i += 1) {
        const slot = (h + i * s) % m;
        probeSequence.push(slot);
        if (table[slot] === probe) {
            found = true;
            break;
        }
        if (table[slot] === null) {
            break;
        }
    }
    return { table: table.map((key) => key ?? ""), probeSequence, found };
}

describe("DoubleHashing", () => {
    it("builds the same table and probe sequence as an independent reference", () => {
        const input = mod.defaultInput as { keys: string[]; buckets: number; probe: string };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.buckets);
        const meta = frames[frames.length - 1]!.meta;
        const expected = reference(input.keys, input.buckets, input.probe);
        expect(meta["table"]).toEqual(expected.table);
        expect(meta["probeSequence"]).toEqual(expected.probeSequence);
        expect(meta["found"]).toBe(expected.found);
        expect(meta["home"]).toBe(home(input.probe, input.buckets));
        expect(meta["step"]).toBe(stride(input.probe, input.buckets));
    });

    it("stores every key and never revisits a bucket before an empty one", () => {
        const keys = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta"];
        const m = 13;
        const frames = [...mod.run({ keys, buckets: m, probe: "missing" })];
        checkFrames(frames, m);
        const meta = frames[frames.length - 1]!.meta;
        const table = meta["table"] as string[];
        for (const key of keys) {
            expect(table).toContain(key);
        }
        const sequence = meta["probeSequence"] as number[];
        expect(new Set(sequence).size).toBe(sequence.length);
        expect(meta["found"]).toBe(false);
    });

    it("finds a key that forced a collision with another key", () => {
        const keys = ["Aa", "BB"];
        const m = 11;
        expect(home("Aa", m)).toBe(home("BB", m));
        const frames = [...mod.run({ keys, buckets: m, probe: "BB" })];
        checkFrames(frames, m);
        const meta = frames[frames.length - 1]!.meta;
        expect(meta["found"]).toBe(true);
        const sequence = meta["probeSequence"] as number[];
        expect((meta["table"] as string[])[sequence[sequence.length - 1]!]).toBe("BB");
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
