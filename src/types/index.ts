export type RoleName = 'SUPER_ADMIN' | 'ADMIN' | 'SCHOOL_MANAGER' | 'MEMBER';

export type TicketStatus =
  | 'PENDING'
  | 'SEEN'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'TRANSFERRED'
  | 'UNREACHABLE'
  | 'COMPLETED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type SchoolType = 'PRIVATE' | 'GOVERNMENT' | 'INTERNATIONAL' | 'COMMUNITY' | 'OTHER';

export type SchoolStatus = 'ACTIVE' | 'INACTIVE' | 'CONTACTED' | 'ASSIGNED';

export type CommunicationMethod = 'PHONE' | 'WHATSAPP' | 'EMAIL' | 'IN_PERSON' | 'OTHER';

export type CommunicationResult =
  | 'NO_ANSWER'
  | 'BUSY'
  | 'ANSWERED'
  | 'WRONG_NUMBER'
  | 'WHATSAPP_SENT'
  | 'EMAIL_SENT'
  | 'REPLIED'
  | 'CALLBACK_REQUESTED'
  | 'INVALID_CONTACT'
  | 'OTHER';

export type TodoColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'orange';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  role: RoleName;
  roleDisplayName: string;
  departmentId: string;
  departmentName: string;
  reportsToUserId?: string | null;
  permissions: string[];
  sessionId?: string;
  /** Organization selected by the authenticated session. Optional during the
   * legacy-to-multi-tenant migration; server code must resolve it from
   * membership rather than accepting a browser-supplied organization ID. */
  organizationId?: string;
  organizationName?: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  priority?: string;
  departmentId?: string;
  taskTypeId?: string;
  assigneeId?: string;
  city?: string;
  schoolType?: string;
  clientId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
