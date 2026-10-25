import {bendLaws as laws, extras as extra} from '../../examples/jev-fabric/laws.ts'
import type {Entry} from '../entry.ts'
export const family = 'jev-fabric'
const adapt = (e: (typeof laws)[number]): Entry => ({...e, law_id: e.bend, src: `examples/jev-fabric/laws.ts; ${e.bend}`})
export const bendLaws = laws.map(adapt)
export const extras = extra.map(adapt)
