import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db/prisma';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import type { UserSession } from '@/types';
import { answersSchema, readSetupState, recommendWorkspace, type SetupState } from '@/lib/onboarding/templates';
import { DEFAULT_LEAD_STATUSES, DEFAULT_TICKET_PRIORITIES } from './OrganizationConfigService';
import { AuditService } from './AuditService';

export const progressSchema = z.object({ answers: answersSchema, step: z.number().int().min(1).max(4), skipped: z.boolean().default(false), standard: z.boolean().optional() }).strict();
const completionSchema = z.object({ standard: z.boolean().default(false) }).strict();
const checklistSchema = z.object({ dismissed: z.boolean().optional(), task: z.enum(['invite', 'pipeline', 'task']).optional(), completed: z.boolean().optional() }).strict()
  .refine(input => input.dismissed !== undefined || (input.task !== undefined && input.completed !== undefined), 'Choose a checklist update');
const eventSchema = z.enum(['ONBOARDING_RESUMED', 'ONBOARDING_ABANDONED']);

export class OnboardingService {
  static async get(user: UserSession) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const settings = await prisma.organizationSettings.findUnique({ where: { organizationId }, select: { onboardingState: true, enabledModules: true } });
    return { state: readSetupState(settings?.onboardingState), modules: settings?.enabledModules ? JSON.parse(settings.enabledModules) as string[] : [] };
  }

  private static async owned(user: UserSession) {
    if (!hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE)) throw new Error('Forbidden');
    const context = await requireOrganizationContext(user);
    return context.id;
  }

  // Optimistic row claim serializes every setup mutation, including simultaneous tabs.
  // Claim and configuration writes share one transaction: failures leave the draft intact.
  private static async mutate(user: UserSession, apply: (tx: Prisma.TransactionClient, organizationId: string, state: SetupState) => Promise<SetupState>, allowCompleted = false) {
    const organizationId = await this.owned(user);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(async tx => {
          const settings = await tx.organizationSettings.findUniqueOrThrow({ where: { organizationId } });
          const state = readSetupState(settings.onboardingState);
          if (!state || state.ownerId !== user.id) throw new Error('Forbidden');
          if (state.status === 'COMPLETE' && !allowCompleted) return state;
          const claim = await tx.organizationSettings.updateMany({ where: { organizationId, onboardingState: settings.onboardingState }, data: { updatedAt: new Date() } });
          if (claim.count !== 1) throw new Error('SETUP_CONFLICT');
          const next = await apply(tx, organizationId, state);
          await tx.organizationSettings.update({ where: { organizationId }, data: { onboardingState: JSON.stringify(next) } });
          return next;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (attempt < 2 && (error instanceof Error && error.message === 'SETUP_CONFLICT' || error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')) continue;
        throw error;
      }
    }
    throw new Error('Please retry setup');
  }

  static async save(user: UserSession, input: unknown) {
    const validated = progressSchema.parse(input);
    return this.mutate(user, async (tx, organizationId, state) => {
      if (validated.step === state.step && JSON.stringify(validated.answers) === JSON.stringify(state.answers) && (validated.standard === undefined || validated.standard === state.standard)) return state;
      if (validated.answers.industry !== state.answers.industry) await tx.auditLog.create({ data: { actorId: user.id, organizationId, action: 'ONBOARDING_BUSINESS_SELECTED', entityType: 'Organization', entityId: organizationId, metadata: JSON.stringify({ industry: validated.answers.industry, version: 1 }) } });
      if (validated.step === 3 && state.step < 3) {
        const config = recommendWorkspace(validated.answers);
        await tx.auditLog.create({ data: { actorId: user.id, organizationId, action: 'ONBOARDING_CONFIGURATION_GENERATED', entityType: 'Organization', entityId: organizationId, metadata: JSON.stringify({ template: config.templateId, modules: config.modules, customized: config.customized, version: 1 }) } });
      }
      await tx.auditLog.create({ data: { actorId: user.id, organizationId, action: validated.skipped ? 'ONBOARDING_STEP_SKIPPED' : validated.step > state.step ? 'ONBOARDING_STEP_COMPLETED' : 'ONBOARDING_PROGRESS_SAVED', entityType: 'Organization', entityId: organizationId, metadata: JSON.stringify({ step: state.step, nextStep: validated.step, industry: validated.answers.industry, version: 1 }) } });
      return { ...state, step: validated.step, answers: validated.answers, ...(validated.standard !== undefined ? { standard: validated.standard } : {}) };
    });
  }

  static async complete(user: UserSession, input: unknown) {
    const { standard } = completionSchema.parse(input);
    try {
      return await this.mutate(user, async (tx, organizationId, state) => {
        const config = recommendWorkspace(state.answers, standard);
        const language = state.answers.language;
        // The subscription was created atomically during registration. Setup
        // customizes only tenant-owned workspace configuration; it never trusts
        // a client-supplied plan or changes the authoritative billing record.
        await tx.organization.update({ where: { id: organizationId }, data: { name: state.answers.workspace, language } });
        const settings = await tx.organizationSettings.findUniqueOrThrow({ where: { organizationId } });
        await tx.organizationSettings.update({ where: { organizationId }, data: { enabledModules: JSON.stringify(config.modules), ...(settings.clientTypes === '[]' ? { clientTypes: JSON.stringify(['COMPANY', 'INDIVIDUAL', 'OTHER']) } : {}), ...(settings.leadStatuses === '[]' ? { leadStatuses: JSON.stringify(DEFAULT_LEAD_STATUSES) } : {}), ...(settings.ticketPriorities === '[]' ? { ticketPriorities: JSON.stringify(DEFAULT_TICKET_PRIORITIES) } : {}) } });
        if (config.stages.length) {
          // Never replace an existing pipeline or records (including data added before setup).
          const existing = await tx.pipeline.findFirst({ where: { organizationId, isActive: true } });
          if (!existing) await tx.pipeline.create({ data: { organizationId, name: language === 'ar' ? 'المبيعات' : 'Sales', isDefault: true, stages: { create: config.stages.map(stage => ({ organizationId, name: stage.name[language], order: stage.order, type: stage.type, probability: stage.probability })) } } });
        }
        for (const field of config.fields) await tx.customFieldDefinition.upsert({ where: { organizationId_entityType_key: { organizationId, entityType: field.entityType, key: field.key } }, create: { organizationId, entityType: field.entityType, key: field.key, label: field.label[language], fieldType: field.fieldType, required: false, searchable: true, createdById: user.id, updatedById: user.id }, update: {} });
        const completedAt = new Date().toISOString();
        await tx.auditLog.create({ data: { actorId: user.id, organizationId, action: 'WORKSPACE_PROVISIONED', entityType: 'Organization', entityId: organizationId, metadata: JSON.stringify({ template: config.templateId, version: config.version, customized: config.customized, standard, signupToWorkspaceMs: Date.parse(completedAt) - Date.parse(state.signupStartedAt), setupMs: Date.parse(completedAt) - Date.parse(state.startedAt), timingSource: 'server_signup_start_server_completion' }) } });
        for (const action of ['ONBOARDING_STEP_COMPLETED', 'ONBOARDING_COMPLETED']) await tx.auditLog.create({ data: { actorId: user.id, organizationId, action, entityType: 'Organization', entityId: organizationId, metadata: JSON.stringify({ step: 4, version: 1 }) } });
        return { ...state, status: 'COMPLETE', step: 4, standard, completedAt };
      });
    } catch (error) {
      // Resolve membership again: an attempted foreign organization never receives a log.
      const context = await requireOrganizationContext(user).catch(() => null);
      if (context && hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE)) await AuditService.logAudit({ organizationId: context.id, actorId: user.id, action: 'WORKSPACE_PROVISIONING_FAILED', entityType: 'Organization', entityId: context.id, metadata: { version: 1 } }).catch(() => undefined);
      throw error;
    }
  }

  static async checklist(user: UserSession, input: unknown) {
    const update = checklistSchema.parse(input);
    return this.mutate(user, async (tx, organizationId, state) => {
      if (state.status !== 'COMPLETE') throw new Error('Finish essential setup first');
      const settings = await tx.organizationSettings.findUniqueOrThrow({ where: { organizationId } });
      const modules: string[] = JSON.parse(settings.enabledModules);
      if (update.task === 'invite' && (state.answers.teamSize === '1' || !hasPermission(user, PERMISSIONS.USERS_CREATE)) || update.task === 'pipeline' && (!modules.includes('pipelines') || !hasPermission(user, PERMISSIONS.PIPELINES_MANAGE)) || update.task === 'task' && (!modules.includes('tasks') || !hasPermission(user, PERMISSIONS.TASKS_CREATE))) throw new Error('Forbidden');
      const completed = new Set(state.checklistCompleted ?? []);
      if (update.task) { if (update.completed) completed.add(update.task); else completed.delete(update.task); }
      return { ...state, ...(update.dismissed !== undefined ? { checklistDismissed: update.dismissed } : {}), checklistCompleted: [...completed] };
    }, true);
  }

  static async entered(user: UserSession) {
    return this.mutate(user, async (tx, organizationId, state) => {
      if (state.status !== 'COMPLETE' || state.enteredAt) return state;
      const enteredAt = new Date().toISOString();
      await tx.auditLog.create({ data: { actorId: user.id, organizationId, action: 'ONBOARDING_CRM_ENTERED', entityType: 'Organization', entityId: organizationId, metadata: JSON.stringify({ version: 1, workspaceToEntryMs: Date.parse(enteredAt) - Date.parse(state.completedAt!) }) } });
      return { ...state, enteredAt };
    }, true);
  }

  static async event(user: UserSession, input: unknown) {
    const action = eventSchema.parse(input);
    const organizationId = await this.owned(user);
    const { state } = await this.get(user);
    if (!state || state.ownerId !== user.id || state.status === 'COMPLETE') return;
    await AuditService.logAudit({ actorId: user.id, organizationId, action, entityType: 'Organization', entityId: organizationId, metadata: { step: state.step, version: state.version } });
  }

  static async firstUsefulAction(user: UserSession, entityType: 'Lead' | 'Client', entityId: string) {
    const organizationId = (await requireOrganizationContext(user)).id;
    // Called by the record service after persistence, never accepted as client telemetry.
    await prisma.$transaction(async tx => {
      const settings = await tx.organizationSettings.findUnique({ where: { organizationId } });
      const state = readSetupState(settings?.onboardingState);
      if (!settings || !state || state.status !== 'COMPLETE' || state.firstUsefulAt) return;
      const firstUsefulAt = new Date().toISOString();
      const claim = await tx.organizationSettings.updateMany({ where: { organizationId, onboardingState: settings.onboardingState }, data: { onboardingState: JSON.stringify({ ...state, firstUsefulAt }) } });
      if (!claim.count) return;
      await tx.auditLog.create({ data: { actorId: user.id, organizationId, action: 'ONBOARDING_FIRST_USEFUL_ACTION', entityType, entityId, metadata: JSON.stringify({ signupToActionMs: Date.parse(firstUsefulAt) - Date.parse(state.signupStartedAt), workspaceToActionMs: Date.parse(firstUsefulAt) - Date.parse(state.completedAt!), version: 1 }) } });
    });
  }
}
