/**
 * codeExport.ts – Educational source sketches in four languages.
 *
 * Algorithm modules are TypeScript generators, so there is no reliable way to
 * translate their executable logic into Python, Java, or C++. Instead this
 * module renders each algorithm's textbook pseudocode into a readable,
 * commented source skeleton with the same input shape and complexity. Every
 * output is clearly labeled as pseudocode-derived and not the canonical
 * implementation, so nobody mistakes the sketch for tested source code.
 */

import type { AlgorithmModule } from "@/types";

export type ExportLanguage = "python" | "javascript" | "java" | "cpp";

export const EXPORT_LANGUAGES: Array<{ id: ExportLanguage; label: string }> = [
    { id: "python", label: "Python" },
    { id: "javascript", label: "JavaScript" },
    { id: "java", label: "Java" },
    { id: "cpp", label: "C++" },
];

type ExportSource = Pick<
    AlgorithmModule,
    "id" | "name" | "complexity" | "pseudocode" | "defaultInput"
>;

/** @returns A snake_case identifier for Python and C++. */
function snake(id: string): string {
    return id.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "algorithm";
}

/** @returns A camelCase identifier for JavaScript. */
function camel(id: string): string {
    const parts = id.split(/[^a-zA-Z0-9]+/).filter(Boolean);
    const name = parts
        .map((part, index) =>
            index === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1),
        )
        .join("");
    return /^[A-Za-z]/.test(name) ? name : `algorithm${name}`;
}

/** @returns A capitalized class name for Java. */
function className(id: string): string {
    const base = camel(id);
    return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Prefix each pseudocode line with a language comment marker. */
function commentLines(lines: string[], marker: string, indent: string): string[] {
    const source = lines.length > 0 ? lines : ["Apply the algorithm to the input."];
    return source.map((line, index) => `${indent}${marker} ${index + 1}. ${line.replace(/\s+/g, " ").trim()}`);
}

/** @returns The shared header that marks the output as an educational sketch. */
function header(module: ExportSource, marker: string): string {
    return [
        `${marker} ${module.name} - educational source sketch`,
        `${marker} Pseudocode-derived, NOT the canonical implementation.`,
        `${marker} Time: ${module.complexity.time} | Space: ${module.complexity.space}`,
        `${marker} Expected input shape: ${JSON.stringify(module.defaultInput)}`,
    ].join("\n");
}

/** @returns Readable Python derived from the module's pseudocode. */
function python(module: ExportSource): string {
    return [
        header(module, "#"),
        "",
        `def ${snake(module.id)}(data):`,
        `    """${module.name}: pseudocode-derived sketch, not canonical source.`,
        "",
        `    Args:`,
        `        data: Input with the shape ${JSON.stringify(module.defaultInput)}.`,
        `    """`,
        ...commentLines(module.pseudocode ?? [], "#", "    "),
        "    # Replace these comments with the real algorithm body.",
        "    return data",
        "",
        "",
        'if __name__ == "__main__":',
        `    result = ${snake(module.id)}(${JSON.stringify(module.defaultInput)})`,
        "    print(result)",
        "",
    ].join("\n");
}

/** @returns Readable JavaScript derived from the module's pseudocode. */
function javascript(module: ExportSource): string {
    return [
        header(module, "//"),
        "",
        `function ${camel(module.id)}(data) {`,
        ...commentLines(module.pseudocode ?? [], "//", "    "),
        "    // Replace these comments with the real algorithm body.",
        "    return data;",
        "}",
        "",
        `const result = ${camel(module.id)}(${JSON.stringify(module.defaultInput)});`,
        "console.log(result);",
        "",
    ].join("\n");
}

/** @returns Readable Java derived from the module's pseudocode. */
function java(module: ExportSource): string {
    const name = className(module.id);
    return [
        header(module, "//"),
        "",
        `public class ${name} {`,
        "    public Object run(Object data) {",
        ...commentLines(module.pseudocode ?? [], "//", "        "),
        "        // Replace these comments with the real algorithm body.",
        "        return data;",
        "    }",
        "",
        `    public static void main(String[] args) {`,
        `        Object data = null; // Set to ${JSON.stringify(module.defaultInput)}`,
        `        System.out.println(new ${name}().run(data));`,
        "    }",
        "}",
        "",
    ].join("\n");
}

/** @returns Readable C++ derived from the module's pseudocode. */
function cpp(module: ExportSource): string {
    return [
        header(module, "//"),
        "",
        "#include <iostream>",
        "",
        `// data uses the shape ${JSON.stringify(module.defaultInput)}`,
        `auto ${snake(module.id)}(auto data) {`,
        ...commentLines(module.pseudocode ?? [], "//", "    "),
        "    // Replace these comments with the real algorithm body.",
        "    return data;",
        "}",
        "",
        "int main() {",
        `    auto result = ${snake(module.id)}(0); // Replace with the real input.`,
        "    std::cout << result << std::endl;",
        "    return 0;",
        "}",
        "",
    ].join("\n");
}

/** @returns An educational source sketch in the requested language. */
export function exportCode(module: ExportSource, language: ExportLanguage): string {
    switch (language) {
        case "python":
            return python(module);
        case "javascript":
            return javascript(module);
        case "java":
            return java(module);
        case "cpp":
            return cpp(module);
    }
}
