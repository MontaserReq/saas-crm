import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { AiAssistantToolService, type ToolResult } from '@/server/services/AiAssistantToolService';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import type { UserSession } from '@/types';
import type { McpScope } from './accessTokens';

export type McpServerContext = {
  user: UserSession;
  scopes: readonly McpScope[];
};

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function json(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (item instanceof Date ? item.toISOString() : item));
}

function toolResult(result: ToolResult) {
  return {
    content: [{ type: 'text' as const, text: json(result) }],
    ...(result.ok ? {} : { isError: true }),
  };
}

function readScope(context: McpServerContext): boolean {
  return context.scopes.includes('crm.read');
}

function canViewTickets(user: UserSession): boolean {
  return hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL) || hasPermission(user, PERMISSIONS.TICKETS_VIEW_ASSIGNED);
}

function canExposeTool(context: McpServerContext, name: string): boolean {
  if (!readScope(context)) return false;
  const user = context.user;
  switch (name) {
    case 'searchSchools':
    case 'getSchool':
    case 'getSchoolActivity':
      return hasPermission(user, PERMISSIONS.SCHOOLS_VIEW);
    case 'getSchoolFollowUps':
      return hasPermission(user, PERMISSIONS.SCHOOLS_VIEW) && canViewTickets(user);
    case 'getTickets':
    case 'getMyTickets':
    case 'getMeetings':
    case 'getMeetingMinutes':
      return canViewTickets(user);
    case 'getMyTasks':
      return hasPermission(user, PERMISSIONS.TODO_VIEW) || hasPermission(user, PERMISSIONS.TODO_MANAGE_OWN);
    case 'getDashboardStats':
      return hasPermission(user, PERMISSIONS.ANALYTICS_VIEW);
    case 'getMostOpenAssignees':
      return hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL);
    case 'getCurrentUserPermissions':
    case 'help':
      return true;
    default:
      return false;
  }
}

export function createMcpServer(context: McpServerContext): McpServer {
  const server = new McpServer(
    { name: 'satrcrm-mcp', version: process.env.MCP_SERVER_VERSION || '1.0.0' },
    { maxToolInputElements: 20 },
  );

  if (canExposeTool(context, 'searchSchools')) {
    server.registerTool('searchSchools', {
      title: 'Search CRM customers',
      description: 'Read-only search for customers/schools in the authenticated workspace. Results are permission-filtered and limited to 10 records.',
      inputSchema: { query: z.string().trim().max(120).optional(), status: z.string().trim().max(40).optional(), unassignedOnly: z.boolean().optional() },
      annotations: readAnnotations,
    }, async ({ query, status, unassignedOnly }) => toolResult(await AiAssistantToolService.searchSchools(context.user, { query, status, unassignedOnly: !!unassignedOnly })));
  }

  if (canExposeTool(context, 'getSchool')) {
    server.registerTool('getSchool', {
      title: 'Get customer details',
      description: 'Read-only customer details lookup by CRM id or name.',
      inputSchema: { schoolId: z.string().trim().max(100).optional(), name: z.string().trim().max(120).optional() },
      annotations: readAnnotations,
    }, async ({ schoolId, name }) => toolResult(await AiAssistantToolService.getSchool(context.user, { schoolId, name })));

    server.registerTool('getSchoolActivity', {
      title: 'Get customer activity',
      description: 'Read-only recent ticket activity for a customer.',
      inputSchema: { schoolId: z.string().trim().max(100).optional(), name: z.string().trim().max(120).optional() },
      annotations: readAnnotations,
    }, async ({ schoolId, name }) => toolResult(await AiAssistantToolService.getSchoolActivity(context.user, { schoolId, name })));
  }

  if (canExposeTool(context, 'getSchoolFollowUps')) {
    server.registerTool('getSchoolFollowUps', {
      title: 'Get due customer follow-ups',
      description: 'Read-only list of due customer follow-ups visible to the authenticated user.',
      annotations: readAnnotations,
    }, async () => toolResult(await AiAssistantToolService.getSchoolFollowUps(context.user)));
  }

  if (canExposeTool(context, 'getTickets')) {
    server.registerTool('getTickets', {
      title: 'List CRM tickets',
      description: 'Read-only ticket list filtered by status and priority; results are limited to 10 records.',
      inputSchema: { status: z.string().trim().max(40).optional(), priority: z.string().trim().max(40).optional() },
      annotations: readAnnotations,
    }, async ({ status, priority }) => toolResult(await AiAssistantToolService.getTickets(context.user, { status, priority })));

    server.registerTool('getMyTickets', {
      title: 'List my CRM tickets',
      description: 'Read-only list of tickets assigned to the authenticated user.',
      annotations: readAnnotations,
    }, async () => toolResult(await AiAssistantToolService.getMyTickets(context.user)));

    server.registerTool('getMeetings', {
      title: 'List meetings',
      description: 'Read-only list of CRM meetings visible to the authenticated user.',
      annotations: readAnnotations,
    }, async () => toolResult(await AiAssistantToolService.getMeetings(context.user)));

    server.registerTool('getMeetingMinutes', {
      title: 'Get meeting minutes',
      description: 'Read-only meeting details and action items by ticket id or ticket number.',
      inputSchema: { ticketId: z.string().trim().max(100).optional(), ticketNumber: z.string().trim().max(100).optional() },
      annotations: readAnnotations,
    }, async ({ ticketId, ticketNumber }) => toolResult(await AiAssistantToolService.getMeetingMinutes(context.user, { ticketId, ticketNumber })));
  }

  if (canExposeTool(context, 'getMyTasks')) {
    server.registerTool('getMyTasks', {
      title: 'List my tasks',
      description: 'Read-only list of the authenticated user’s own tasks.',
      annotations: readAnnotations,
    }, async () => toolResult(await AiAssistantToolService.getMyTasks(context.user)));
  }

  if (canExposeTool(context, 'getDashboardStats')) {
    server.registerTool('getDashboardStats', {
      title: 'Get dashboard statistics',
      description: 'Read-only aggregate dashboard statistics for the authenticated workspace.',
      annotations: readAnnotations,
    }, async () => toolResult(await AiAssistantToolService.getDashboardStats(context.user)));
  }

  if (canExposeTool(context, 'getMostOpenAssignees')) {
    server.registerTool('getMostOpenAssignees', {
      title: 'Get busiest assignees',
      description: 'Read-only aggregate of users with the most open tickets.',
      annotations: readAnnotations,
    }, async () => toolResult(await AiAssistantToolService.getMostOpenAssignees(context.user)));
  }

  if (canExposeTool(context, 'getCurrentUserPermissions')) {
    server.registerTool('getCurrentUserPermissions', {
      title: 'Get my CRM permissions',
      description: 'Read-only information about the authenticated user’s role, department, and effective permissions.',
      annotations: readAnnotations,
    }, async () => toolResult(await AiAssistantToolService.getCurrentUserPermissions(context.user)));
  }

  if (canExposeTool(context, 'help')) {
    server.registerTool('help', {
      title: 'Get CRM help',
      description: 'Read-only help for CRM features. Topics requiring unavailable permissions are filtered.',
      inputSchema: { topic: z.string().trim().max(100).optional() },
      annotations: readAnnotations,
    }, async ({ topic }) => toolResult(AiAssistantToolService.help(context.user, { topic })));
  }

  return server;
}

export function mcpToolNamesForUser(context: McpServerContext): string[] {
  const names = ['searchSchools', 'getSchool', 'getSchoolActivity', 'getSchoolFollowUps', 'getTickets', 'getMyTickets', 'getMeetings', 'getMeetingMinutes', 'getMyTasks', 'getDashboardStats', 'getMostOpenAssignees', 'getCurrentUserPermissions', 'help'];
  return names.filter((name) => canExposeTool(context, name));
}
