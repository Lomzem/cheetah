import formulaIndexJson from '../../../formula-data/index.json'
import algebraIJson from '../../../formula-data/algebra-i.json'
import algebraIIJson from '../../../formula-data/algebra-ii.json'
import geometryJson from '../../../formula-data/geometry.json'
import preAlgebraJson from '../../../formula-data/pre-algebra.json'
import type { Formula, FormulaClass } from './schema'
import { formulaClassSchema, formulaIndexSchema } from './schema'

const formulaIndex = formulaIndexSchema.parse(formulaIndexJson)

const formulaClasses = [
  preAlgebraJson,
  algebraIJson,
  algebraIIJson,
  geometryJson,
].map((classData) => formulaClassSchema.parse(classData))

const formulaById = new Map<string, Formula>()

for (const classData of formulaClasses) {
  for (const category of classData.categories) {
    for (const formula of category.formulas) {
      formulaById.set(formula.id, formula)
    }
  }
}

export function getFormulaIndex() {
  return formulaIndex
}

export function getFormulaClasses() {
  return formulaClasses
}

export function getFormulaById(id: string) {
  return formulaById.get(id)
}

export function getSelectedFormulaGroups(selectedIds: string[]) {
  const selected = new Set(selectedIds)

  return formulaClasses
    .map((classData) => {
      const categories = classData.categories
        .map((category) => ({
          ...category,
          formulas: category.formulas.filter((formula) =>
            selected.has(formula.id),
          ),
        }))
        .filter((category) => category.formulas.length > 0)

      return {
        ...classData,
        categories,
      }
    })
    .filter((classData) => classData.categories.length > 0)
}

export function getFormulaStats() {
  const categoryCount = formulaClasses.reduce(
    (sum, classData) => sum + classData.categories.length,
    0,
  )

  return {
    classCount: formulaClasses.length,
    categoryCount,
    formulaCount: formulaById.size,
  }
}

export function getClassById(classId: string): FormulaClass | undefined {
  return formulaClasses.find((classData) => classData.id === classId)
}
