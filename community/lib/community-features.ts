// Enable only after configuring an application owned by this deployment.
export const DINGTALK_ENABLED=false;
// Replaced at build time only for the isolated desktop app.
declare const __LEO_DESKTOP__:boolean;
export const DESKTOP=typeof __LEO_DESKTOP__!=='undefined'&&__LEO_DESKTOP__;
