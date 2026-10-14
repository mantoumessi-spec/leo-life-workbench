// This adapter is only compiled into the desktop process, never the hosted app.
export async function getChatGPTUser(){return {userId:'desktop_local',displayName:'我的工作台',email:'local@sites.test',fullName:null};}
