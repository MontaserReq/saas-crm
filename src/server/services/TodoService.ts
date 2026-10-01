import prisma from '@/lib/db/prisma';
import { todoSchema } from '@/lib/validation';

export class TodoService {
  private static async organizationForUser(userId: string) {
    const membershipModel = (prisma as any).organizationMember;
    const membership = membershipModel?.findFirst
      ? await membershipModel.findFirst({ where: { userId, status: 'ACTIVE', organization: { isActive: true } }, orderBy: { createdAt: 'asc' }, select: { organizationId: true } })
      : null;
    return membership?.organizationId || 'org_codeline_legacy';
  }
  /**
   * Returns personal To-Do notes strictly filtered by the authenticated user's ID.
   */
  static async listTodos(userId: string) {
    const organizationId = await this.organizationForUser(userId);
    return prisma.todo.findMany({
      where: { userId, organizationId },
      orderBy: [
        { isCompleted: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  static async createTodo(userId: string, data: any) {
    const validated = todoSchema.parse(data);
    const organizationId = await this.organizationForUser(userId);
    return prisma.todo.create({
      data: {
        userId,
        organizationId,
        title: validated.title,
        description: validated.description || null,
        priority: validated.priority || 'MEDIUM',
        color: validated.color || 'yellow',
        dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
      },
    });
  }

  static async updateTodo(userId: string, id: string, data: any) {
    const validated = todoSchema.parse(data);
    const organizationId = await this.organizationForUser(userId);

    // Verify ownership
    const existing = await prisma.todo.findFirst({
      where: { id, userId, organizationId },
    });
    if (!existing) {
      throw new Error('To-Do not found or unauthorized');
    }

    return prisma.todo.update({
      where: { id },
      data: {
        title: validated.title,
        description: validated.description || null,
        priority: validated.priority,
        color: validated.color,
        dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
      },
    });
  }

  static async changeColor(userId: string, id: string, color: string) {
    const organizationId = await this.organizationForUser(userId);
    const existing = await prisma.todo.findFirst({
      where: { id, userId, organizationId },
    });
    if (!existing) {
      throw new Error('To-Do not found or unauthorized');
    }

    return prisma.todo.update({
      where: { id },
      data: { color },
    });
  }

  static async toggleComplete(userId: string, id: string) {
    const organizationId = await this.organizationForUser(userId);
    const existing = await prisma.todo.findFirst({
      where: { id, userId, organizationId },
    });
    if (!existing) {
      throw new Error('To-Do not found or unauthorized');
    }

    const nextCompleted = !existing.isCompleted;
    return prisma.todo.update({
      where: { id },
      data: {
        isCompleted: nextCompleted,
        completedAt: nextCompleted ? new Date() : null,
      },
    });
  }

  static async deleteTodo(userId: string, id: string) {
    const organizationId = await this.organizationForUser(userId);
    const existing = await prisma.todo.findFirst({
      where: { id, userId, organizationId },
    });
    if (!existing) {
      throw new Error('To-Do not found or unauthorized');
    }

    return prisma.todo.delete({
      where: { id },
    });
  }
}
