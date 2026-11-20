/**
 * cqrs.test.ts - Independent event-sourced reference, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./cqrs";
import type { VisualFrame } from "@/types";

interface Command { type: "deposit" | "withdraw"; account: string; amount: number }

/** Reference: fold commands into accept flags and final balances. */
function reference(accounts: string[], commands: Command[], initial: Record<string, number>) {
    const balances = new Map<string, number>(accounts.map((a) => [a, initial[a] ?? 0]));
    const accepted: boolean[] = [];
    const events: string[] = [];
    for (const cmd of commands) {
        let ok = false;
        const before = balances.get(cmd.account);
        if (before !== undefined && cmd.amount >= 0) {
            if (cmd.type === "deposit") {
                balances.set(cmd.account, before + cmd.amount);
                ok = true;
            } else if (cmd.type === "withdraw" && before >= cmd.amount) {
                balances.set(cmd.account, before - cmd.amount);
                ok = true;
            }
        }
        accepted.push(ok);
        if (ok) events.push(`${cmd.type}:${cmd.account}:${cmd.amount}`);
    }
    return { balances: Object.fromEntries(balances), accepted, events };
}

function checkFrames(frames: VisualFrame[], entities: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(entities);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("CQRS", () => {
    it("matches an independent event-sourced fold", () => {
        const cases: Array<{ accounts: string[]; commands: Command[]; initial: Record<string, number> }> = [
            {
                accounts: ["checking", "savings"],
                commands: [
                    { type: "deposit", account: "checking", amount: 100 },
                    { type: "deposit", account: "savings", amount: 50 },
                    { type: "withdraw", account: "checking", amount: 30 },
                    { type: "withdraw", account: "savings", amount: 80 },
                    { type: "deposit", account: "checking", amount: 20 },
                ],
                initial: {},
            },
            {
                accounts: ["a", "b", "c"],
                commands: [
                    { type: "deposit", account: "a", amount: 10 },
                    { type: "deposit", account: "b", amount: 20 },
                    { type: "withdraw", account: "a", amount: 15 },
                    { type: "withdraw", account: "c", amount: 1 },
                    { type: "deposit", account: "b", amount: 5 },
                ],
                initial: { a: 5 },
            },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ accounts: testCase.accounts, commands: testCase.commands, initialBalances: testCase.initial })];
            checkFrames(frames, testCase.accounts.length + testCase.commands.length);
            const finalMeta = frames[frames.length - 1]?.meta;
            const expected = reference(testCase.accounts, testCase.commands, testCase.initial);
            const parsed = (key: string): Record<string, number> =>
                JSON.parse(String(finalMeta?.[key] ?? "{}")) as Record<string, number>;
            expect(parsed("balances")).toEqual(expected.balances);
            expect(parsed("readModel")).toEqual(expected.balances);
            expect(parsed("writeState")).toEqual(expected.balances);
            expect(finalMeta?.["events"]).toEqual(expected.events);
        }
    });

    it("marks rejected commands but never projects them", () => {
        const frames = [...mod.run({
            accounts: ["x"],
            commands: [
                { type: "withdraw", account: "x", amount: 10 },
                { type: "deposit", account: "x", amount: 10 },
            ],
            initialBalances: { x: 0 },
        })];
        expect(frames[1]?.meta["accepted"]).toBe(false);
        expect(frames[1]?.meta["events"]).toEqual([]);
        expect(frames[2]?.meta["accepted"]).toBe(true);
        expect(frames[frames.length - 1]?.meta["events"]).toEqual(["deposit:x:10"]);
        const rejectedCell = frames[1]?.entities.find((e) => e.id === "event-0");
        expect(rejectedCell?.state).toBe("error");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
