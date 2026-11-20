/**
 * copy-on-write-snapshot.test.ts - Snapshot semantics check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./copy-on-write-snapshot";
import type { VisualFrame } from "@/types";

type Operation =
    | { op: "snapshot"; label: string }
    | { op: "write"; page: number; value: number };

interface Input {
    initial: number[];
    operations: Operation[];
}

/** Brute-force model: a snapshot is a full deep copy of the live values. */
function reference(input: Input) {
    let live = [...input.initial];
    const snapshots: Record<string, number[]> = {};
    for (const operation of input.operations) {
        if (operation.op === "snapshot") {
            snapshots[operation.label] = [...live];
        } else {
            live = [...live];
            live[operation.page] = operation.value;
        }
    }
    return { live, snapshots };
}

function unpackSnapshots(meta: VisualFrame["meta"] | undefined, pages: number): Record<string, number[]> {
    const labels = (meta?.["snapshotLabels"] as string[]) ?? [];
    const flat = (meta?.["snapshotFlat"] as number[]) ?? [];
    const result: Record<string, number[]> = {};
    labels.forEach((label, index) => {
        result[label] = flat.slice(index * pages, (index + 1) * pages);
    });
    return result;
}

function checkFrames(frames: VisualFrame[], pages: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(pages);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(pages);
    });
}

describe("CopyOnWriteSnapshot", () => {
    it("keeps every snapshot stable on the default workload", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.initial.length);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["currentValues"]).toEqual(expected.live);
        expect(unpackSnapshots(final, input.initial.length)).toEqual(expected.snapshots);
        expect(Number(final?.["copies"])).toBe(3);
        expect(Number(final?.["physicalPages"])).toBe(7);
        expect(Number(final?.["totalRefs"])).toBe(input.initial.length * (1 + Object.keys(expected.snapshots).length));
    });

    it("matches the copy model across randomized workloads", () => {
        let seed = 31;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        for (let trial = 0; trial < 20; trial += 1) {
            const pages = 2 + Math.floor(rand() * 5);
            const initial = Array.from({ length: pages }, () => Math.floor(rand() * 50));
            const operations: Operation[] = [];
            let snapshotId = 0;
            for (let i = 0; i < 12; i += 1) {
                if (rand() < 0.4) {
                    snapshotId += 1;
                    operations.push({ op: "snapshot", label: `s${snapshotId}` });
                } else {
                    operations.push({
                        op: "write",
                        page: Math.floor(rand() * pages),
                        value: Math.floor(rand() * 1000),
                    });
                }
            }
            const input: Input = { initial, operations };
            const frames = [...mod.run(input)];
            checkFrames(frames, pages);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["currentValues"]).toEqual(expected.live);
            expect(unpackSnapshots(final, pages)).toEqual(expected.snapshots);
            expect(Number(final?.["totalRefs"])).toBe(pages * (1 + Object.keys(expected.snapshots).length));
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
