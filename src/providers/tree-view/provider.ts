import * as vscode from "vscode"

import { AbstractProblem, AbstractStatus, BriefProblem } from "@/jutge_api_client"
import { ConfigService } from "@/services/config"
import { JutgeTreeItem } from "./item"
import { JutgeService } from "@/services/jutge"

const _error = (msg: string) => console.error(`[TreeViewProvider] ${msg}`)

export class CourseDataProvider implements vscode.TreeDataProvider<JutgeTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<JutgeTreeItem | undefined | null | void> =
        new vscode.EventEmitter<JutgeTreeItem | undefined | null | void>()

    readonly onDidChangeTreeData: vscode.Event<JutgeTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event

    private context_: vscode.ExtensionContext

    constructor(context: vscode.ExtensionContext) {
        this.context_ = context
    }

    refresh(item?: JutgeTreeItem): void {
        this._onDidChangeTreeData.fire(item)
    }

    // Get TreeItem representation of the element (part of the TreeDataProvider interface).
    getTreeItem(element: JutgeTreeItem): JutgeTreeItem {
        return element
    }

    /**
     * Get children of an element.
     * If an empty list is returned, a welcome view is shown.
     * viewsWelcome are defined in `package.json`.
     */
    async getChildren(element?: JutgeTreeItem): Promise<JutgeTreeItem[]> {
        if (!(await JutgeService.isUserAuthenticated())) {
            return []
        }
        if (!element && JutgeService.isExamMode()) {
            return this._getExam()
        } else if (!element) {
            return this._getEnrolledCourseList()
        } else if (element.contextValue === "exam") {
            return this._getExamProblems(element)
        } else if (element.contextValue === "course") {
            return this._getListsFromCourseNm(element)
        } else if (element.contextValue === "list") {
            return this._getProblemsFromListNm(element)
        }
        return []
    }

    private async _getExamProblems(element: JutgeTreeItem): Promise<JutgeTreeItem[]> {
        try {
            const swrExam = JutgeService.getExamSWR()
            swrExam.onUpdate = () => this.refresh(element)

            const exam = swrExam.data
            if (!exam) {
                return []
            }

            const problem_nms = exam.problems.map((p) => p.problem_nm)

            const swrProblems = JutgeService.getAbstractProblemsSWR(problem_nms)
            swrProblems.onUpdate = () => this.refresh(element)

            const swrStatus = JutgeService.getAllStatusesSWR()
            swrStatus.onUpdate = () => this.refresh(element)

            if (swrProblems.data === undefined || swrStatus.data === undefined) {
                return []
            }

            const abstractProblems = swrProblems.data
            const allStatuses = swrStatus.data

            const items: JutgeTreeItem[] = []
            for (const abstractProblem of abstractProblems) {
                items.push(this._abstractProblemToItem(abstractProblem, allStatuses))
            }
            return items
            //
        } catch (error) {
            console.log(error)
            vscode.window.showErrorMessage("Failed ot get exam problems")
            return []
        }
    }

    private async _getExam(): Promise<JutgeTreeItem[]> {
        try {
            const swrExam = JutgeService.getExamSWR()
            swrExam.onUpdate = () => this.refresh()

            const exam = swrExam.data
            if (!exam) {
                return []
            }
            const state = this.context_.globalState.get<"collapsed" | "expanded" | "none">(`itemState:exam`)
            return [new JutgeTreeItem(exam.title, state || "collapsed", "exam", "exam")]
        } catch (error) {
            console.log(error)
            vscode.window.showErrorMessage("Failed ot get exam")
            return []
        }
    }

    private async _getEnrolledCourseList(): Promise<JutgeTreeItem[]> {
        try {
            const result = JutgeService.getCoursesSWR()
            const courses = result.data || {}
            result.onUpdate = () => this.refresh() // all

            return Object.entries(courses).map(([key, course]) => {
                const state = this.context_.globalState.get<"collapsed" | "expanded" | "none">(`itemState:${key}`)
                return new JutgeTreeItem(course.course_nm, state || "collapsed", key, "course")
            })
        } catch (error) {
            console.error(error)
            vscode.window.showErrorMessage("Failed to get enrolled courses")
            return []
        }
    }

    private async _getListsFromCourseNm(courseElem: JutgeTreeItem): Promise<JutgeTreeItem[]> {
        try {
            const courseRes = JutgeService.getCourseSWR(courseElem.itemKey)
            courseRes.onUpdate = () => this.refresh(courseElem)

            const course = courseRes.data
            if (course === undefined) {
                return []
            }

            return course.lists.map((list) => {
                const key = list.list_nm
                const state = this.context_.globalState.get<"collapsed" | "expanded" | "none">(`itemState:${key}`)
                return new JutgeTreeItem(list.title || list.list_nm, state || "collapsed", key, "list")
            })
            //
        } catch (error) {
            console.error(error)
            vscode.window.showErrorMessage(`Failed to get lists from course: ${courseElem.itemKey}`)
            return []
        }
    }

    private _abstractProblemToItem(
        abstractProblem: AbstractProblem,
        allStatuses: Record<string, AbstractStatus>
    ): JutgeTreeItem {
        const nm = abstractProblem.problem_nm
        const problemItem = new JutgeTreeItem(nm, "none", nm, "problem")
        const langCode = ConfigService.getPreferredLangId()
        const preferredId = `${nm}_${langCode}`

        let problem: BriefProblem | undefined = undefined
        if (preferredId in abstractProblem.problems) {
            problem = abstractProblem.problems[preferredId]
        } else {
            problem = Object.values(abstractProblem.problems)[0]
        }

        // Get status for this problem
        const status = allStatuses[nm]?.status

        problemItem.label = `${this._getIconForStatus(status)} ${problem.title}`
        problemItem.command = {
            command: "jutge-vscode.showProblem",
            title: "Open Problem",
            arguments: [nm],
        }

        return problemItem
    }

    private async _getProblemsFromListNm(listElem: JutgeTreeItem): Promise<JutgeTreeItem[]> {
        try {
            console.debug(`[TreeViewProvider] Getting Problems for list '${listElem.itemKey}'`)

            const swrProblems = JutgeService.getAbstractProblemsInListSWR(listElem.itemKey)
            swrProblems.onUpdate = () => this.refresh(listElem)

            const swrStatus = JutgeService.getAllStatusesSWR()
            swrStatus.onUpdate = () => this.refresh(listElem)

            if (swrProblems.data === undefined || swrStatus.data === undefined) {
                return []
            }

            const problems = swrProblems.data
            const allStatuses = swrStatus.data

            const items: JutgeTreeItem[] = []
            for (const abstractProblem of problems) {
                items.push(this._abstractProblemToItem(abstractProblem, allStatuses))
            }

            return items
            //
        } catch (error) {
            console.error("Error getting problems from list:", error)
            return []
        }
    }

    private _getIconForStatus(status: string | undefined): string {
        switch (status) {
            case "":
                return ""
            case "accepted":
                return "🟢"
            case "rejected":
                return "🔴"
            default:
                return "⚪"
        }
    }
}
