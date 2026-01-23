import { ProblemHandler, TestcaseStatus } from "@/types"

export enum Checker {
    STD = "std",
    ELASTIC = "elastic",
    ELASTIC2 = "elastic2",
    UNK = "unk", //ficticious checker
}

export interface CheckerRunner {
    run(output: string, solution: string, problemHandler: ProblemHandler | null): TestcaseStatus
}

export interface CheckerInfo {
    checker: Checker
    runner: CheckerRunner
    implemented: boolean
    driver: string
}

class ElasticRunner implements CheckerRunner {
    run(output: string, solution: string, problemHandler: ProblemHandler) {
        if (output === solution) {
            return TestcaseStatus.PASSED
        }

        const aV = output.split("\n")
        aV.pop() // Remove final line after endl

        const bV = solution.split("\n")
        bV.pop()

        if (aV.length !== bV.length) {
            return TestcaseStatus.FAILED
        }

        aV.sort()
        bV.sort()

        const n = aV.length
        for (let i = 0; i < n; ++i) {
            if (aV[i] !== bV[i]) {
                return TestcaseStatus.FAILED
            }
        }
        return TestcaseStatus.PASSED
    }
}

class STDRunner implements CheckerRunner {
    run(output: string, solution: string, problemHandler: ProblemHandler) {
        return output === solution ? TestcaseStatus.PASSED : TestcaseStatus.FAILED
    }
}

const __checkers: Record<Checker, CheckerInfo> = {
    [Checker.STD]: {
        checker: Checker.STD,
        runner: new STDRunner(),
        implemented: true,
        driver: "std",
    },
    [Checker.ELASTIC]: {
        checker: Checker.ELASTIC,
        runner: new ElasticRunner(),
        implemented: true,
        driver: "std",
    },
    [Checker.ELASTIC2]: {
        checker: Checker.ELASTIC2,
        runner: new STDRunner(),
        implemented: false,
        driver: "std",
    },
    [Checker.UNK]: {
        checker: Checker.UNK,
        runner: new STDRunner(), // If I have nothing else, use STD.
        implemented: false,
        driver: "std",
    },
}

export function checkerFindIf(func: (info: CheckerInfo) => boolean): Checker {
    for (const [checker, info] of Object.entries(__checkers)) {
        if (func(info)) {
            return checker as Checker
        }
    }
    return Checker.STD as Checker // Default, will usually work (as much as possible)
}

export function checkerInfoGet(checker: Checker): CheckerInfo {
    for (const [check, info] of Object.entries(__checkers)) {
        if (checker === check) {
            return info as CheckerInfo
        }
    }
    return __checkers[Checker.UNK] as CheckerInfo // Not defined above
}

export function checkerInfoByName(name: string | undefined) {
    if (!name) {
        return checkerInfoGet(Checker.STD)
    }
    return checkerInfoGet(name as Checker)
}
