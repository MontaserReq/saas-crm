// The read-only tool allow-list. This is the actual security boundary, not
// the prompt: the router only ever dispatches a tool whose name appears
// here, so even if the classification model is tricked (prompt injection)
// into naming a mutating-sounding tool, there is nothing for it to call —
// no createX/updateX/deleteX function exists anywhere in this module.
export const ALLOWED_TOOLS = new Set([
  'searchSchools',
  'getSchool',
  'getSchoolActivity',
  'getSchoolFollowUps',
  'getTickets',
  'getMyTickets',
  'getMeetings',
  'getMeetingMinutes',
  'getMyTasks',
  'getDashboardStats',
  'getMostOpenAssignees',
  'getCurrentUserPermissions',
  'help',
  'none',
] as const);

export type ToolName = typeof ALLOWED_TOOLS extends Set<infer T> ? T : never;

export function isAllowedTool(name: string): name is ToolName {
  return ALLOWED_TOOLS.has(name as ToolName);
}
