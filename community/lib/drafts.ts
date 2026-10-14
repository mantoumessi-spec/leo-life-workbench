import { stateSchema, type Workspace } from './workspace.ts';
export type DraftEnvelope={format:1;savedAt:string;base:Workspace;draft:Workspace};
export function parseDraft(raw:string):DraftEnvelope{
 const value=JSON.parse(raw);if(value.format!==1||typeof value.savedAt!=='string')throw new Error('草稿格式不正确');
 return {format:1,savedAt:value.savedAt,base:stateSchema.parse(value.base),draft:stateSchema.parse(value.draft)};
}
export function draftKey(scope:string,week:string){return `leo-planning-draft-v4:${encodeURIComponent(scope)}:${week}`;}
