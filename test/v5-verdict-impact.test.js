'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const verdict=require('../plugin/sd0x-dev-flow-codex/skills/seek-verdict/scripts/verdict-state');
const evidence=[{evidence_id:'1'.repeat(64),binding_hash:'a'.repeat(64)}];
const registry=new Map([[evidence[0].evidence_id,{binding_hash:evidence[0].binding_hash,independence_key:'verifier:independent',source_id:'independent-agent'}]]);
const input={finding_key:'feature-boundary',fingerprint:'b'.repeat(64),intent:'clarify',severity:'P1',confidence:0.70,evidence,origin:'native-codex',session:'test',branch:'feature/test',dismissal_evidence_hash:verdict.evidenceHash(evidence),user_turn:1};
test('clarify impact has its own confidence threshold and never grants dismissal',()=>{
 for(const impact of ['HIGH_IMPACT','LOW_IMPACT']){
  const result=verdict.evaluate(null,{...input,impact_assessment:impact},registry);
  assert.equal(result.impact_assessment,impact);assert.equal(result.transition,'UNRESOLVED');assert.equal(result.state.candidate,null);
  assert.throws(()=>verdict.evaluate(result.state,{...input,impact_assessment:impact},registry),/consumed/);
  assert.equal(verdict.evaluate(null,{...input,confidence:0.69,impact_assessment:impact},registry).impact_assessment,'UNCERTAIN');
 }
});
test('missing or mismatched impact is explicit uncertainty, not actionability',()=>{
 const missing=verdict.evaluate(null,input,registry);assert.equal(missing.impact_assessment,'UNCERTAIN');assert.equal(missing.impact_intent_mismatch,true);
 assert.equal(verdict.evaluate(null,{...input,intent:'confirm',impact_assessment:'HIGH_IMPACT'},registry).impact_assessment,'NOT_ASSESSED');
 assert.throws(()=>verdict.evaluate(null,{...input,impact_assessment:'ACTIONABLE'},registry),/invalid/);
});
