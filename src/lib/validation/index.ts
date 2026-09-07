import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const schoolSchema = z.object({
  name: z.string().min(2, 'School name is required'),
  contactPerson: z.string().optional().nullable(),
  phone: z.preprocess((value) => value === undefined || value === null || value === '' ? value : String(value).trim(), z.string().regex(/^\d{7,12}$/, 'Invalid phone number').optional().nullable()),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  city: z.string().min(2, 'City is required'),
  area: z.string().optional().nullable(),
  classification: z.enum(['A', 'B', 'C']).default('A'),
  schoolType: z.string().default('PRIVATE'),
  responsibleEmployeeId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'CONTACTED', 'ASSIGNED']).default('ACTIVE'),
});

export const schoolImportRowSchema = z.object({
  name: z.string().min(2, 'School name is required'),
  contactPerson: z.string().optional().nullable(),
  phone: z.preprocess((value) => value === undefined || value === null || value === '' ? value : String(value).trim(), z.string().regex(/^\+?[0-9][0-9\s()\-]{5,20}$/, 'Invalid phone number').optional().nullable()),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  city: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  classification: z.enum(['A', 'B', 'C'], { required_error: 'Classification must be A, B, or C' }),
  responsibleEmployeeId: z.string().optional().nullable(),
});

export const schoolAssignmentSchema = z.object({
  taskTypeId: z.string().min(1, 'Task Type is required'),
  departmentId: z.string().min(1, 'Department is required'),
  assigneeIds: z.array(z.string()).min(1, 'Select at least one assignee'),
  schoolIds: z.array(z.string()).min(1, 'Select at least one school'),
  strategy: z.enum(['EQUAL_DISTRIBUTION', 'MANUAL']).default('EQUAL_DISTRIBUTION'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const ticketRejectSchema = z.object({
  ticketId: z.string().min(1, 'Ticket ID is required'),
  reason: z.string().min(5, 'Rejection reason must be at least 5 characters'),
});

export const ticketTransferSchema = z.object({
  ticketId: z.string().min(1, 'Ticket ID is required'),
  targetUserId: z.string().min(1, 'Select a team member to transfer to'),
  reason: z.string().min(3, 'Transfer reason / handoff notes are required'),
});

export const createNoteSchema = z.object({
  ticketId: z.string().min(1, 'Ticket ID is required'),
  content: z.string().min(2, 'Note content cannot be empty'),
  priority: z.string().optional().nullable(),
  transferToUserId: z.string().optional().nullable(),
});

export const communicationAttemptSchema = z.object({
  ticketId: z.string().min(1, 'Ticket ID is required'),
  method: z.enum(['PHONE', 'WHATSAPP', 'EMAIL', 'IN_PERSON', 'OTHER']),
  result: z.enum([
    'NO_ANSWER',
    'INVALID_CONTACT',
  ]),
  note: z.string().optional().nullable(),
});

export const rejectedTicketUpdateSchema = z.object({
  ticketId: z.string().min(1, 'Ticket ID is required'),
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(200),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  dueDate: z.string().optional().nullable(),
  followUpAt: z.string().optional().nullable(),
});

export const todoSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  color: z.enum(['yellow', 'blue', 'green', 'pink', 'purple', 'orange']).default('yellow'),
  dueDate: z.string().optional().nullable(),
});

export const userCreateSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional().nullable(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  roleId: z.string().min(1, 'Role is required'),
  departmentId: z.string().min(1, 'Department is required'),
  reportsToUserId: z.string().optional().nullable(),
});

export const userUpdateSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional().nullable(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  roleId: z.string().min(1, 'Role is required'),
  departmentId: z.string().min(1, 'Department is required'),
  isActive: z.boolean().default(true),
  accessMode: z.enum(['ANY_IP', 'RESTRICTED_IPS']).default('ANY_IP'),
  allowedIps: z.array(z.string().ip()).default([]),
  reportsToUserId: z.string().optional().nullable(),
  directPermissionIds: z.array(z.string()).optional(),
});

export const departmentSchema = z.object({
  name: z.string().min(2, 'Department name is required'),
  code: z.string().min(2, 'Code is required').toUpperCase(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const taskTypeSchema = z.object({
  name: z.string().trim().min(2, 'Task name is required'),
  departmentId: z.string().min(1, 'Department is required'),
  members: z.array(z.object({
    userId: z.string().min(1),
    responsibility: z.string().trim().min(1, 'Responsibility is required'),
  })).default([]),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const createMessageSchema = z.object({
  toUserIds: z.array(z.string()).min(1, 'Select at least one recipient'),
  ccUserIds: z.array(z.string()).optional().default([]),
  subject: z.string().min(1, 'Subject is required'),
  content: z.string().min(1, 'Message content is required'),
});
