import * as fs from "fs"
import { JutgeService } from "@/services/jutge"
import { dirname } from "path"
import * as vscode from "vscode"
import { Testcase } from "./jutge_api_client"
import * as os from "os"

/**
 * A function that returns whether the os is Windows.
 *
 * @returns true/false
 */
export function isWindows() {
    return os.type() === "Windows_NT"
}

/**
 * A helper function that returns a unique alphanumeric identifier called a nonce.
 *
 * @remarks This function is primarily used to help enforce content security
 * policies for resources/scripts being executed in a webview context.
 *
 * @returns A nonce
 */
export function getNonce() {
    let text = ""
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text
}

/**
 * A helper function that returns a boolean indicating whether a given problem name is valid and accessible.
 *
 */
export async function isProblemValidAndAccessible(problemNm: string): Promise<boolean> {
    try {
        await JutgeService.getAbstractProblemSWR(problemNm)
        return true
    } catch (error) {
        return false
    }
}

export async function chooseFromEditorList(
    editors: readonly vscode.TextEditor[]
): Promise<vscode.TextEditor | undefined> {
    // Filter out non-file editors (e.g. logs, output, terminal)
    editors = editors.filter((editor) => editor.document.uri.scheme === "file")
    if (editors.length === 0) {
        return
    }
    if (editors.length === 1) {
        return editors[0]
    }

    const selectedEditor = await vscode.window.showQuickPick(
        editors.map((editor) => ({
            label: editor.document.fileName,
            description: editor.document.languageId,
            editor,
        }))
    )
    // TODO: What if
    return selectedEditor?.editor
}

export const preferredLangToLangId: { [key: string]: string } = {
    Català: "ca",
    Castellano: "es",
    English: "en",
}
export const fallbackLangOrder = ["ca", "es", "en", "fr"]

export function getDefaultProblemId(problemNm: string): string {
    const preferredLang = vscode.workspace.getConfiguration("jutge-vscode").get("problem.preferredLang") as string
    const preferredLangId = preferredLangToLangId[preferredLang]
    return problemNm + "_" + preferredLangId
}

export const getWorkingDirectory = (filename: string) => {
    let workingDir = ""
    let workspaces = vscode.workspace.workspaceFolders
    if (workspaces && workspaces.length > 0) {
        // TODO: Check that this uri is not remote?
        workingDir = workspaces[0].uri.path
    } else {
        workingDir = dirname(filename)
    }
    if (isWindows() && workingDir[0] === "/") {
        workingDir = workingDir.slice(1)
    }
    console.debug(`[Helpers] Working dir: "${workingDir}"`)
    return workingDir
}

export async function waitMilliseconds(time_ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), time_ms)
    })
}

export function stringToFilename(title: string): string {
    title = title.replace(/ /g, "_") // Replace spaces with underscores
    title = title.replace(/[à,á]/g, "a") // Replace accents
    title = title.replace(/[è,é]/g, "e") // Replace accents
    title = title.replace(/[í,ï]/g, "i") // Replace accents
    title = title.replace(/[ò,ó]/g, "o") // Replace accents
    title = title.replace(/[ú,ü]/g, "u") // Replace accents
    title = title.replace(/[^a-zA-Z0-9_]/g, "") // Remove other special characters except underscores
    return title
}

export function decodeTestcase(testcase: Testcase): { input: string; expected: string } {
    const { input_b64, correct_b64 } = testcase
    const input = Buffer.from(input_b64, "base64").toString("utf-8")
    const expected = Buffer.from(correct_b64, "base64").toString("utf-8")
    return { input, expected }
}

type LoggerKind = "debug" | "info" | "warn" | "error"
const allKinds: LoggerKind[] = ["debug", "info", "warn", "error"]

export class Logger {
    get log() {
        const _class = this.constructor.name

        const logger =
            (kind: LoggerKind) =>
            (...msgs: any[]) =>
                console[kind](`[${_class}]:`, ...msgs)

        return Object.fromEntries(allKinds.map((kind) => [kind, logger(kind)]))
    }
}

export class StaticLogger {
    static get log() {
        const _class = this.name

        const logger =
            (kind: LoggerKind) =>
            (...msgs: any[]) =>
                console[kind](`[${_class}]:`, ...msgs)

        return Object.fromEntries(allKinds.map((kind) => [kind, logger(kind)]))
    }
}

export function fileExistsOrThrow(filePath: string) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File '${filePath}' does not exist.`)
    }
}
