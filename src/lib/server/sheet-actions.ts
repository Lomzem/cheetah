import { createServerFn } from '@tanstack/react-start'
import { compileRequestSchema } from '#/lib/latex'
import { compileSheet } from './compiler'

export const compilePreview = createServerFn({ method: 'POST' })
  .inputValidator(compileRequestSchema)
  .handler(async ({ data }) => {
    return compileSheet(data)
  })
