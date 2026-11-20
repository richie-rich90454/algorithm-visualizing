import { describe, expect, it } from "vitest";
import mod from "./nysiis";

/** Independent reference implementation of the published NYSIIS rules. */
function reference(word: string): string {
    let name = word.toUpperCase().replace(/[^A-Z]/g, "");
    if (name.length === 0) {
        return "";
    }
    const prefixes: Array<[string, string]> = [
        ["MAC", "MCC"], ["KN", "NN"], ["PH", "FF"], ["PF", "FF"],
        ["SCH", "SSS"], ["EV", "AF"],
    ];
    let replaced = false;
    for (const [from, to] of prefixes) {
        if (name.startsWith(from)) {
            name = to + name.slice(from.length);
            replaced = true;
            break;
        }
    }
    if (!replaced && name.startsWith("K")) {
        name = "C" + name.slice(1);
    }
    if (name.endsWith("EE") || name.endsWith("IE")) {
        name = name.slice(0, -2) + "Y";
    } else if (/(DT|RT|RD|NT|ND)$/.test(name)) {
        name = name.slice(0, -2) + "D";
    }

    const vowel = (c: string | undefined): boolean => c !== undefined && "AEIOU".indexOf(c) >= 0;
    const out: string[] = [name[0] as string];
    let idx = 1;
    while (idx < name.length) {
        const current = name[idx] as string;
        const after = name[idx + 1];
        const before = name[idx - 1];
        let rule = current;
        let skip = 1;
        if (vowel(current)) {
            if (current === "E" && after === "V") {
                rule = "AF";
                skip = 2;
            } else {
                rule = "A";
            }
        } else if (current === "Q") {
            rule = "G";
        } else if (current === "Z") {
            rule = "S";
        } else if (current === "M") {
            rule = "N";
        } else if (current === "K") {
            rule = after === "N" ? "N" : "C";
        } else if (name.slice(idx, idx + 3) === "SCH") {
            rule = "SSS";
            skip = 3;
        } else if (name.slice(idx, idx + 2) === "PH") {
            rule = "FF";
            skip = 2;
        } else if (current === "H" && (!vowel(before) || !vowel(after))) {
            rule = before as string;
        } else if (current === "W" && vowel(before)) {
            rule = before as string;
        }
        for (const ch of rule) {
            if (out[out.length - 1] !== ch) {
                out.push(ch);
            }
        }
        idx += skip;
    }
    let code = out.join("");
    if (code.endsWith("S")) {
        code = code.slice(0, -1);
    }
    if (code.endsWith("AY")) {
        code = code.slice(0, -2) + "Y";
    }
    if (code.endsWith("A")) {
        code = code.slice(0, -1);
    }
    return code;
}

function finalCode(word: string): string {
    const all = [...mod.run({ word })];
    return all[all.length - 1]!.meta["code"] as string;
}

describe("NYSIIS", () => {
    it("agrees with the reference implementation on deterministic names", () => {
        const names = [
            "Schmidt", "Kevin", "McDonald", "MacDonald", "Knight", "Phillip",
            "Stephen", " Evans", "Smith", "Thompson", "Wagner", "O'Brien",
            "123anywhere", "", "X", "EE", "DNT", "A",
        ];
        for (const name of names) {
            expect(finalCode(name)).toBe(reference(name));
        }
    });

    it("matches the reference on seeded random letter strings", () => {
        let seed = 424242;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (let trial = 0; trial < 300; trial += 1) {
            const len = 1 + (rand() % 12);
            let name = "";
            for (let i = 0; i < len; i += 1) {
                name += alphabet[rand() % alphabet.length];
            }
            expect(finalCode(name)).toBe(reference(name));
        }
    });

    it("satisfies output properties", () => {
        const words = ["Schmidt", "Kevin", "McDonald", "Knight", "Phillip", "Smith", "Evans"];
        for (const word of words) {
            const code = finalCode(word);
            expect(code).toMatch(/^[A-Z]*$/);
            for (let i = 1; i < code.length; i += 1) {
                expect(code[i]).not.toBe(code[i - 1]);
            }
            expect(finalCode(word)).toBe(code);
        }
    });

    it("emits well-formed frames with sequential steps and in-range code lines", () => {
        const all = [...mod.run(mod.defaultInput)];
        expect(all.length).toBeGreaterThan(2);
        all.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.layout).toBe("text");
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
            expect(typeof frame.meta["code"]).toBe("string");
            for (const entity of frame.entities) {
                expect(entity.type).toBe("character");
            }
        });
    });

    it("terminates cleanly", () => {
        let count = 0;
        for (const _frame of mod.run(mod.defaultInput)) {
            count += 1;
            expect(count).toBeLessThan(100);
        }
        expect(count).toBeGreaterThan(0);
    });
});
