/**
 * command-logging.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./command-logging";
import type { VisualFrame } from "@/types";

type Value = number | string;
function apply(state: Record<string, Value>, command: { op: string; key: string; value?: Value }): void {
    switch (command.op) {
        case "set": state[command.key] = command.value ?? 0; break;
        case "incr": state[command.key] = Number(state[command.key] ?? 0) + Number(command.value ?? 1); break;
        case "append": state[command.key] = `${String(state[command.key] ?? "")}${String(command.value ?? "")}`; break;
        case "del": delete state[command.key]; break;
    }
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Logical command logging", () => {
    it("replaying the log matches an independent reference on several workloads", () => {
        const workloads = [
            [
                { op: "set", key: "a", value: 0 },
                { op: "incr", key: "a", value: 5 },
                { op: "incr", key: "a", value: 3 },
                { op: "set", key: "s", value: "x" },
                { op: "append", key: "s", value: "yz" },
                { op: "del", key: "a" },
            ],
            [
                { op: "set", key: "k", value: 10 },
                { op: "incr", key: "k", value: -4 },
                { op: "append", key: "other", value: "first" },
                { op: "append", key: "other", value: "second" },
            ],
            [],
        ];
        for (const commands of workloads) {
            const frames = [...mod.run({ commands })];
            checkFrames(frames);
            const expected: Record<string, Value> = {};
            for (const command of commands) { apply(expected, command); }
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["state"]).toEqual(expected);
            expect(meta?.["matches"]).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
