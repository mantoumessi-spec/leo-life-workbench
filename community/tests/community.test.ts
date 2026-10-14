import test from 'node:test';
import assert from 'node:assert/strict';
import {seedState,stateSchema} from '../lib/workspace.ts';
import {mergeWorkspaceDraft} from '../lib/planning.ts';
test('community initialization has no personal content or invented records',()=>{const s=seedState();assert.equal(s.displayName,'');assert.equal(s.northStar,'');for(const key of ['plans','tasks','logs','reviews'] as const)assert.deepEqual(s[key],[]);assert.deepEqual(s.projects.map(p=>p.name),['项目 1','项目 2','项目 3','项目 4','项目 5','项目 6']);assert.ok(s.projects.every(p=>!p.summary&&!p.next&&!p.purpose));assert.deepEqual(stateSchema.parse(s),s);});
test('profile edits merge with records on another device and old backups remain valid',()=>{const base=seedState(),remote={...base,northStar:'远端方向'},draft={...base,displayName:'小林'};const merged=mergeWorkspaceDraft(base,remote,draft);assert.deepEqual(merged.conflicts,[]);assert.equal(merged.state.displayName,'小林');assert.equal(merged.state.northStar,'远端方向');const legacy:any=structuredClone(base);delete legacy.displayName;assert.equal(stateSchema.parse(legacy).displayName,'');});
