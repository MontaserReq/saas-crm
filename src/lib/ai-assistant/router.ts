import { UserSession } from '@/types';
import { AiAssistantToolService, ToolResult } from '@/server/services/AiAssistantToolService';
import { isAllowedTool, ToolName } from './tools';

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : undefined;
}

/**
 * Dispatches a classified {tool, args} pair to the matching read-only tool.
 * This is the actual enforcement point: `isAllowedTool` is checked again
 * here (defense in depth on top of classify.ts's own check), and the
 * `switch` only ever calls a fixed set of read-only AiAssistantToolService
 * methods — there is no code path from here to any mutation, no matter what
 * the classification step (or a prompt-injection attempt) produced.
 */
export async function routeTool(
  user: UserSession,
  tool: string,
  args: Record<string, unknown>
): Promise<{ tool: ToolName; result: ToolResult | null }> {
  if (!isAllowedTool(tool)) return { tool: 'none', result: null };

  switch (tool) {
    case 'searchSchools':
      return { tool, result: await AiAssistantToolService.searchSchools(user, { query: str(args.query), status: str(args.status), unassignedOnly: !!args.unassignedOnly }) };
    case 'getSchool':
      return { tool, result: await AiAssistantToolService.getSchool(user, { schoolId: str(args.schoolId), name: str(args.name) }) };
    case 'getSchoolActivity':
      return { tool, result: await AiAssistantToolService.getSchoolActivity(user, { schoolId: str(args.schoolId), name: str(args.name) }) };
    case 'getSchoolFollowUps':
      return { tool, result: await AiAssistantToolService.getSchoolFollowUps(user) };
    case 'getTickets':
      return { tool, result: await AiAssistantToolService.getTickets(user, { status: str(args.status), priority: str(args.priority) }) };
    case 'getMyTickets':
      return { tool, result: await AiAssistantToolService.getMyTickets(user) };
    case 'getMeetings':
      return { tool, result: await AiAssistantToolService.getMeetings(user) };
    case 'getMeetingMinutes':
      return { tool, result: await AiAssistantToolService.getMeetingMinutes(user, { ticketId: str(args.ticketId), ticketNumber: str(args.ticketNumber) }) };
    case 'getMyTasks':
      return { tool, result: await AiAssistantToolService.getMyTasks(user) };
    case 'getDashboardStats':
      return { tool, result: await AiAssistantToolService.getDashboardStats(user) };
    case 'getMostOpenAssignees':
      return { tool, result: await AiAssistantToolService.getMostOpenAssignees(user) };
    case 'getCurrentUserPermissions':
      return { tool, result: await AiAssistantToolService.getCurrentUserPermissions(user) };
    case 'help':
      return { tool, result: AiAssistantToolService.help(user, { topic: str(args.topic) }) };
    case 'none':
    default:
      return { tool: 'none', result: null };
  }
}
