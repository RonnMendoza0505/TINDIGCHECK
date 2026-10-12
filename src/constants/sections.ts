
/*
    SYSTEM FUNCTION:
    Defines the supported Grade levels
    for Lourdes Northwest Elementary School.
*/
export const GRADE_LEVELS = [1, 2, 3, 4, 5, 6];

/*
    SYSTEM FUNCTION:
    Defines Sections available for each Grade.

    IMPORTANT:
    Section A and Section B are temporary
    examples. Replace them with the actual
    Section names before registering learners.
*/
export const SECTIONS = [
    "Section A",
    "Section B",
    "Section C",
    "Section D",
    "Section E"
];

/*
    SYSTEM FUNCTION:
    Returns all five sections for the
    selected Grade level.
*/
export function getSectionsByGrade(
    grade: number
): string[] {
    if (grade < 1 || grade > 6) {
        return [];
    }

    return SECTIONS;
}