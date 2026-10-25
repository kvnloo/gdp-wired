import {watch} from '../../core/watch.ts'
import {session} from './port.ts'
import {sequencePredicates} from './laws.ts'
const traces:Record<string,string[]>={
 sequence_verifier_after_ask:['start','finish','record','claim'],
 sequence_verifier_after_update:['ask','start','finish','record','change','claim'],
 sequence_verifier_finishes_after_start:['ask','start','record','claim'],
 sequence_update_after_verifier:['ask','start','finish','claim'],
 sequence_delegate_result_before_verifier:['ask','delegate','start','finish','record','claim'],
}
export function sequenceWitness(law:string,bug:string) {
 const r=session(bug),inter=r.interpreter(),predicate=sequencePredicates[law],sl=r.stepLaw(law,(_b:any,a:any)=>a.accepted.eq(1).implies(predicate(a)))
 let st=inter.init({}),broke=false,at=-1
 const observer=watch(r.machine,inter,sl,{},4);observer.start(st)
 for(const [i,event] of traces[law].entries()) {const input=r.encodeInput({event,ok:true}),before=st;st=inter.step({},st,input);if(!observer.step(before,input,st)){broke=true;at=i}}
 return {broke,at,trace:traces[law],final:st.scalars,scope:'target sequence law only, not a helper invariant'}
}
