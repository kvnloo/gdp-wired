import {domain} from '../../examples/domains/cloud.ts'
import type {Entry} from '../entry.ts'
export const family = 'domains-cloud'
export const bendLaws: Entry[] = []
// Three independent stateful rules, with all their invariant and step laws.
export const extras: Entry[] = domain.cases.slice(0, 3).map(c => ({n: 0, law_id: c.name, src: 'examples/domains/cloud.ts', bend: c.name, says: c.about, fns: c.name, kind: 'law', encoding: 'exact', case: () => c}))
