// The entry every z0 family's laws.ts exports: examples/jev-fabric/laws.ts's Entry, plus where the law comes from.
// Contract: /mnt/zer0models/workspace/zer0/data/operations/gdp-wired-laws/CONTRACT.md
import type {Case} from '../examples/harness.ts'

export type Kind = 'decide' | 'relate' | 'law' | 'step law' | 'k-step law' | 'liveness' | 'list/set' | 'chart' | 'outside'

export type Entry = {
  n: number // 1.. the Bend law's place in LAWS.bend; 0 for an extra
  law_id: string // the Bend law's name (e.g. 'o8_notify_once'), or the extra's id
  src: string // path:line of the law in the pinned z0 checkout (an extra: the source of the rule it reads)
  bend: string // file: law (or the extra's name), as jev-fabric prints it
  says: string
  fns: string // the Bend (and twin) functions it reads
  kind: Kind
  encoding: 'exact' | 'interned' | 'abstracted'
  note?: string
  how?: 'automatic' | 'added fact' | 'added invariant' | 'added lemma'
  case: () => Case
  witness?: () => {breaks: boolean, detail: string}
}
