/** broadcast-encryption.test.ts - Access-control, brute-force, frame and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./broadcast-encryption";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], users: number): void {
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(users);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Broadcast Encryption (Toy)", () => {
    it("lets exactly the privileged users recover the message", () => {
        const input = mod.defaultInput as {
            userCount: number;
            privileged: number[];
            message: number;
            masterSecret: number;
            sessionKey: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.userCount);
        const meta = frames[frames.length - 1]?.meta;
        const recovered = meta?.["recovered"] as Record<string, number | boolean>;
        for (let id = 0; id < input.userCount; id += 1) {
            const expectedPrivileged = input.privileged.includes(id);
            const value = recovered[`user${id}`];
            if (expectedPrivileged) expect(value).toBe(input.message);
            else expect(value).toBe(false);
        }
        expect(meta?.["cipher"]).toBe((input.message + input.sessionKey) % 256);
    });

    it("matches a brute-force header reconstruction for arbitrary privileged sets", () => {
        for (const privileged of [[], [0], [1, 3], [0, 1, 2, 3, 4, 5]]) {
            const input = { userCount: 6, privileged, message: 77, masterSecret: 9, sessionKey: 200 };
            const frames = [...mod.run(input)];
            const meta = frames[frames.length - 1]?.meta;
            const header = meta?.["header"] as Array<{ userId: number; wrapped: number }>;
            expect(header.length).toBe(privileged.length);
            for (const id of privileged) expect(header.some((e) => e.userId === id)).toBe(true);
            const recovered = meta?.["recovered"] as Record<string, number | boolean>;
            for (let id = 0; id < 6; id += 1) {
                const should = privileged.includes(id) ? 77 : false;
                expect(recovered[`user${id}`]).toBe(should);
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
