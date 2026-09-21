import { z } from 'zod';

const schoolPhone = z.preprocess(
  (value) => value === undefined || value === null || value === '' ? value : String(value).trim(),
  z.string().refine(
    (value) => value.split(/[,;/\n]+/).every((part) => /^\+?[0-9][0-9\s()\-]{5,20}$/.test(part.trim())),
    'Invalid phone number. Separate multiple numbers with commas.'
  ).optional().nullable()
);

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const schoolSchema = z.object({
  name: z.string().min(2, 'School name is required'),
  contactPerson: z.string().optional().nullable(),
  phone: schoolPhone,
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
  phone: schoolPhone,
  whatsapp: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  city: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  classification: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return '';
      const s = String(val).trim().toUpperCase().replace(/^(?:CLASS|الفئة|فئة)\s*/u, '').trim();
      if (s === 'أ') return 'A';
      if (s === 'ب') return 'B';
      if (s === 'ج') return 'C';
      if (['A', 'B', 'C'].includes(s)) return s;
      return '';
    },
    // The importer normalizes missing values to an empty string above. Keep
    // the output non-null so it can be used safely in preview rows and Prisma
    // create data, whose classification field is a required string.
    z.string().default('')
  ),
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
  content: z.string().min(2, 'Note content cannot be empty').refine(
    val => val.trim().length >= 2,
    'Note content must be at least 2 characters and not just whitespace'
  ),
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
  schoolId: z.string().optional().nullable(),
  phone: z.string().max(100).optional().nullable(),
  whatsapp: z.string().max(100).optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  taskTypeId: z.string().optional().nullable(),
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(200),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  dueDate: z.string().optional().nullable(),
  followUpAt: z.string().optional().nullable(),
  correctionNote: z.string().trim().max(5000).optional().nullable(),
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

export const schoolResearchRequiredFields = ['phone', 'email', 'website', 'address', 'contactPerson', 'schoolType'] as const;

export const schoolResearchJobSchema = z.object({
  // ENRICH_EXISTING / VERIFY_EXISTING are reserved for a future iteration (see AI School Research plan) — only FIND_NEW ships in v1.
  mode: z.enum(['FIND_NEW']).default('FIND_NEW'),
  location: z.string().trim().min(2, 'Location is required'),
  area: z.string().trim().optional().nullable(),
  schoolType: z.string().trim().optional().nullable(),
  requestedCount: z.coerce.number().int().min(1, 'Must request at least 1 school').max(500, 'Requested count is too large'),
  requiredFields: z.array(z.enum(schoolResearchRequiredFields)).min(1, 'Select at least one required field'),
});

export const schoolResearchCandidateRejectSchema = z.object({
  candidateId: z.string().min(1, 'Candidate ID is required'),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const schoolResearchCandidateBulkApproveSchema = z.object({
  candidateIds: z.array(z.string().min(1)).min(1, 'Select at least one candidate').max(200, 'Too many candidates selected at once'),
});

export const meetingParticipantSchema = z.object({
  name: z.string().trim().min(1, 'Participant name is required'),
  userId: z.string().optional().nullable(),
});

export const meetingActionItemSchema = z.object({
  text: z.string().trim().min(1, 'Action item text is required'),
  assigneeId: z.string().optional().nullable(),
  done: z.boolean().default(false),
});

export const createMeetingTicketSchema = z.object({
  schoolId: z.string().optional().nullable(),
  taskTypeId: z.string().optional().nullable(),
  departmentId: z.string().optional(),
  subject: z.string().trim().min(3, 'Meeting title must be at least 3 characters').max(200),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.string().optional().nullable(),
  meetingDate: z.string().min(1, 'Meeting date is required'),
  meetingTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Meeting time must be in HH:mm format'),
  participants: z.array(meetingParticipantSchema).min(1, 'At least one participant is required'),
  actionItems: z.array(meetingActionItemSchema).default([]),
  initialNote: z.string().optional().nullable(),
});

export const createMessageSchema = z.object({
  toUserIds: z.array(z.string()).min(1, 'Select at least one recipient'),
  ccUserIds: z.array(z.string()).optional().default([]),
  subject: z.string().min(1, 'Subject is required'),
  content: z.string().min(1, 'Message content is required'),
});
