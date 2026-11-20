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

/**
 * @returns A literal of `value` valid in the target language. JSON's true /
 * false / null are not valid Python or C++ literals, so translate them. The
 * value is already JSON, so JSON.stringify is a safe starting point.
 */
function literal(value: unknown, language: ExportLanguage): string {
    const json = JSON.stringify(value) ?? "null";
    if (language === "python") {
        return json
            .replace(/\btrue\b/g, "True")
            .replace(/\bfalse\b/g, "False")
            .replace(/\bnull\b/g, "None");
    }
    // JSON booleans are valid JavaScript; C++ accepts true/false and nullptr.
    if (language === "cpp") {
        return json.replace(/\bnull\b/g, "nullptr");
    }
    return json;
}

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
function header(module: ExportSource, marker: string, language: ExportLanguage): string {
    return [
        `${marker} ${module.name} - educational source sketch`,
        `${marker} Pseudocode-derived, NOT the canonical implementation.`,
        `${marker} Time: ${module.complexity.time} | Space: ${module.complexity.space}`,
        `${marker} Expected input shape: ${literal(module.defaultInput, language)}`,
    ].join("\n");
}

/** @returns Readable Python derived from the module's pseudocode. */
function python(module: ExportSource): string {
    return [
        header(module, "#", "python"),
        "",
        `def ${snake(module.id)}(data):`,
        `    """${module.name}: pseudocode-derived sketch, not canonical source.`,
        "",
        `    Args:`,
        `        data: Input with the shape ${literal(module.defaultInput, "python")}.`,
        `    """`,
        ...commentLines(module.pseudocode ?? [], "#", "    "),
        "    # Replace these comments with the real algorithm body.",
        "    return data",
        "",
        "",
        'if __name__ == "__main__":',
        `    result = ${snake(module.id)}(${literal(module.defaultInput, "python")})`,
        "    print(result)",
        "",
    ].join("\n");
}

/** @returns Readable JavaScript derived from the module's pseudocode. */
function javascript(module: ExportSource): string {
    const language: ExportLanguage = "javascript";
    return [
        header(module, "//", language),
        "",
        `function ${camel(module.id)}(data) {`,
        ...commentLines(module.pseudocode ?? [], "//", "    "),
        "    // Replace these comments with the real algorithm body.",
        "    return data;",
        "}",
        "",
        `const result = ${camel(module.id)}(${literal(module.defaultInput, language)});`,
        "console.log(result);",
        "",
    ].join("\n");
}

/** @returns Readable Java derived from the module's pseudocode. */
function java(module: ExportSource): string {
    const name = className(module.id);
    const language: ExportLanguage = "java";
    return [
        header(module, "//", language),
        "",
        `public class ${name} {`,
        "    public Object run(Object data) {",
        ...commentLines(module.pseudocode ?? [], "//", "        "),
        "        // Replace these comments with the real algorithm body.",
        "        return data;",
        "    }",
        "",
        `    public static void main(String[] args) {`,
        `        Object data = null; // Set to ${literal(module.defaultInput, language)}`,
        `        System.out.println(new ${name}().run(data));`,
        "    }",
        "}",
        "",
    ].join("\n");
}

/** @returns Readable C++ derived from the module's pseudocode. */
function cpp(module: ExportSource): string {
    const language: ExportLanguage = "cpp";
    return [
        header(module, "//", language),
        "",
        "#include <iostream>",
        "",
        `// data uses the shape ${literal(module.defaultInput, language)}`,
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
