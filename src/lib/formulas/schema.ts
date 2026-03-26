import { z } from 'zod'

export const formulaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  typst: z.string().min(1),
})

export const formulaCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  formulas: z.array(formulaSchema).min(1),
})

export const formulaClassSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  categories: z.array(formulaCategorySchema).min(1),
})

export const formulaIndexEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  file: z.string().min(1),
  categoryCount: z.number().int().positive(),
  formulaCount: z.number().int().positive(),
})

export const formulaIndexSchema = z.object({
  classes: z.array(formulaIndexEntrySchema).min(1),
})

export type Formula = z.infer<typeof formulaSchema>
export type FormulaCategory = z.infer<typeof formulaCategorySchema>
export type FormulaClass = z.infer<typeof formulaClassSchema>
export type FormulaIndex = z.infer<typeof formulaIndexSchema>
