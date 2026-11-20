/**
 * kelips-dht.test.ts - Lookup correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { kelipsLookups, kelipsTables, keyOwner, nodeGroup } from "./kelips-dht";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent direct map from keys to owners. */
function bruteOwners(nodes: number, groups: number, keys: number[]): Map<number, number> {
    const members: number[][] = Array.from({ length: groups }, () => []);
    for (let id = 0; id < nodes; id += 1) {
        members[id % groups]!.push(id);
    }
    const map = new Map<number, number>();
    for (const key of keys) {
        const bucket = members[key % groups]!;
        map.set(key, bucket[key % bucket.length]!);
    }
    return map;
}

describe("Kelips DHT", () => {
    it("partitions nodes and stores one contact per group", () => {
        const tables = kelipsTables(6, 3);
        expect(tables.members).toEqual([[0, 3], [1, 4], [2, 5]]);
        expect(nodeGroup(5, 3)).toBe(2);
        expect(keyOwner(10, [1, 4])).toBe(1);
        for (const row of tables.contacts) {
            expect(row).toEqual([0, 1, 2]);
        }
    });

    it("routes every key to the brute-force owner", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const lookups = final?.["lookups"] as Array<{ key: number; owner: number }>;
        const expected = bruteOwners(6, 3, [10, 11, 12, 13, 14, 15]);
        for (const lookup of lookups) {
            expect(lookup.owner).toBe(expected.get(lookup.key));
        }
        expect(final?.["success"]).toBe(true);
        expect(Number(final?.["resolved"])).toBe(6);
    });

    it("agrees with an independent lookup table on a different topology", () => {
        const nodes = 8;
        const groups = 4;
        const keys = [3, 7, 11, 19, 23, 31];
        const tables = kelipsTables(nodes, groups);
        const lookups = kelipsLookups(keys, groups, tables);
        const expected = bruteOwners(nodes, groups, keys);
        lookups.forEach((lookup) => expect(lookup.owner).toBe(expected.get(lookup.key)));
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
