import prisma from '@/lib/db/prisma';
import { SchoolType, SchoolStatus, PaginationParams, PaginatedResult, UserSession } from '@/types';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { schoolSchema, schoolImportRowSchema } from '@/lib/validation';
import { AuditService } from './AuditService';
import { mapSchoolImportRow, matchImportEmployee, normalizeImportPhone, resolveImportHeaders } from '@/lib/schools/import';

export interface SchoolFilters extends PaginationParams {
  city?: string;
  schoolType?: string;
  classification?: string;
  status?: string;
  unassignedOnly?: boolean;
}

export interface ImportPreviewRow {
  index: number;
  data: {
    name: string;
    contactPerson?: string | null;
    responsibleEmployee?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    city: string;
    area?: string | null;
    classification?: string;
    schoolType?: string;
    notes?: string | null;
  };
  status: 'valid' | 'invalid' | 'duplicate';
  errors?: string[];
  duplicateReason?: string;
}

export class SchoolService {
  static async createApprovalRequest(schoolId: string, type: 'EDIT' | 'DELETE', requesterId: string, proposedData?: any) {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new Error('School not found');
    const pending = await prisma.schoolApprovalRequest.findFirst({ where: { schoolId, type, status: 'PENDING' } });
    if (pending) throw new Error('A pending approval request already exists for this school');
    const request = await prisma.schoolApprovalRequest.create({ data: { schoolId, requesterId, type, previousData: JSON.stringify(school), proposedData: proposedData ? JSON.stringify(proposedData) : null } });
    await AuditService.logAudit({ actorId: requesterId, action: `SCHOOL_${type}_REQUESTED`, entityType: 'SchoolApprovalRequest', entityId: request.id, metadata: { schoolId } });
    const approvers = await prisma.user.findMany({
      where: { isActive: true, role: { rolePermissions: { some: { permission: { code: type === 'EDIT' ? 'schools.approve_edit' : 'schools.approve_delete' } } } } },
      select: { id: true },
    });
    if (approvers.length) {
      await prisma.notification.createMany({
        data: approvers.map((approver) => ({
          userId: approver.id,
          type: 'SCHOOL_APPROVAL_REQUESTED',
          title: `${type === 'EDIT' ? 'School edit' : 'School deletion'} request pending`,
          message: `A ${type.toLowerCase()} request for ${school.name} is waiting for your approval.`,
          entityType: 'schoolApprovalRequest',
          entityId: request.id,
        })),
      });
    }
    return request;
  }

  static async decideApproval(requestId: string, approverId: string, approve: boolean, rejectionReason?: string) {
    const request = await prisma.schoolApprovalRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== 'PENDING') throw new Error('Approval request is not pending');
    if (approve && request.type === 'EDIT' && request.proposedData) {
      const proposed = JSON.parse(request.proposedData);
      await this.updateSchool(request.schoolId, proposed, approverId);
    } else if (approve && request.type === 'DELETE') {
      await this.deleteSchool(request.schoolId, approverId);
    }
    const result = await prisma.schoolApprovalRequest.update({ where: { id: requestId }, data: { status: approve ? 'APPROVED' : 'REJECTED', decidedById: approverId, decidedAt: new Date(), rejectionReason: approve ? null : (rejectionReason || 'Rejected by approver') } });
    await AuditService.logAudit({ actorId: approverId, action: `SCHOOL_APPROVAL_${approve ? 'APPROVED' : 'REJECTED'}`, entityType: 'SchoolApprovalRequest', entityId: requestId, metadata: { type: request.type, schoolId: request.schoolId, rejectionReason } });
    await prisma.notification.create({
      data: {
        userId: request.requesterId,
        type: `SCHOOL_APPROVAL_${approve ? 'APPROVED' : 'REJECTED'}`,
        title: `${request.type === 'EDIT' ? 'School edit' : 'School deletion'} request ${approve ? 'approved' : 'rejected'}`,
        message: approve
          ? `Your ${request.type.toLowerCase()} request for the school was approved.`
          : `Your ${request.type.toLowerCase()} request for the school was rejected${rejectionReason ? `: ${rejectionReason}` : '.'}`,
        entityType: 'schoolApprovalRequest',
        entityId: request.id,
      },
    });
    return result;
  }
  static async listSchools(filters: SchoolFilters): Promise<PaginatedResult<any>> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 15;
    const skip = (page - 1) * pageSize;

    const where: any = { isDeleted: false };
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.trim();
      const searchOr = [
        { name: { contains: q, mode: 'insensitive' } },
        { contactPerson: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { area: { contains: q, mode: 'insensitive' } },
      ];
      if (where.OR) where.AND = [{ OR: where.OR }, { OR: searchOr }];
      else where.OR = searchOr;
    }

    if (filters.city) {
      where.city = filters.city;
    }

    if (filters.classification && filters.classification !== 'ALL') {
      where.classification = filters.classification;
    }

    if (filters.schoolType && filters.schoolType !== 'ALL') {
      where.schoolType = filters.schoolType;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.unassignedOnly) {
      // Find schools that have no active / pending / in-progress tickets
      where.tickets = {
        none: {
          status: { in: ['PENDING', 'SEEN', 'ACCEPTED', 'IN_PROGRESS'] },
        },
      };
    }

    const [total, data] = await Promise.all([
      prisma.school.count({ where }),
      prisma.school.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true } },
          responsibleEmployee: { select: { id: true, name: true, email: true } },
          _count: { select: { tickets: true } },
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getSchoolById(user: UserSession, id: string) {
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)) {
      throw new Error('Forbidden: Missing schools.view permission');
    }

    return prisma.school.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        responsibleEmployee: { select: { id: true, name: true, email: true } },
        tickets: {
          orderBy: { createdAt: 'desc' },
          include: {
            taskType: true,
            assignees: {
              where: { isCurrent: true },
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
      },
    });
  }

  static async createSchool(data: any, actorId: string) {
    const validated = schoolSchema.parse(data);

    const school = await prisma.school.create({
      data: {
        ...validated,
        createdById: actorId,
      },
    });

    await AuditService.logAudit({
      actorId,
      action: 'SCHOOL_CREATED',
      entityType: 'School',
      entityId: school.id,
      metadata: { name: school.name, city: school.city },
    });

    return school;
  }

  static async updateSchool(id: string, data: any, actorId: string) {
    const validated = schoolSchema.parse(data);

    const school = await prisma.school.update({
      where: { id },
      data: {
        ...validated,
      },
    });

    await AuditService.logAudit({
      actorId,
      action: 'SCHOOL_UPDATED',
      entityType: 'School',
      entityId: school.id,
      metadata: { name: school.name },
    });

    return school;
  }

  /**
   * Safely deletes or archives a school depending on historical relation existence.
   */
  static async deleteSchool(id: string, actorId: string) {
    const school = await prisma.school.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tickets: true },
        },
      },
    });

    if (!school) {
      throw new Error('School not found');
    }

    if (school._count.tickets > 0) {
      // Historical data exists -> safe archive / soft delete
      await prisma.school.update({
        where: { id },
        data: {
          isDeleted: true,
          status: 'INACTIVE',
          deletedAt: new Date(),
        },
      });
    } else {
      // No relations -> safe hard delete
      await prisma.school.delete({
        where: { id },
      });
    }

    await AuditService.logAudit({
      actorId,
      action: 'SCHOOL_DELETED',
      entityType: 'School',
      entityId: id,
      metadata: { name: school.name, ticketsCount: school._count.tickets },
    });

    return { success: true };
  }

  /**
   * Parses and validates uploaded raw rows from CSV / Excel file.
   */
  static async validateImportRows(rawRows: any[]): Promise<{
    preview: ImportPreviewRow[];
    validCount: number;
    invalidCount: number;
    duplicateCount: number;
    detectedColumns: string[];
    mappedColumns: Record<string, { header: string; index: number }>;
    ignoredColumns: { header: string; index: number; ignored: true }[];
    missingOptionalColumns: string[];
  }> {
    if (!Array.isArray(rawRows) || rawRows.length === 0) throw new Error('The import file contains no data rows');
    if (rawRows.length > 5000) throw new Error('The maximum allowed import size is 5,000 rows');
    const headerResolution = resolveImportHeaders(Object.keys(rawRows[0] || {}));
    if (headerResolution.missingRequired.length) {
      const labels = headerResolution.missingRequired.map((field) => field === 'name' ? 'School Name / اسم المدرسة' : 'School Classification / فئة المدرسة');
      throw new Error(`Required column is missing: ${labels.join(', ')}.`);
    }
    if (headerResolution.duplicates.length) {
      throw new Error(`Duplicate column header: ${headerResolution.duplicates.join(', ')}.`);
    }
    const existingSchools = await prisma.school.findMany({
      select: { name: true, phone: true },
    });
    const employees = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
    });

    const existingNames = new Set(existingSchools.map((s) => s.name.trim().replace(/\s+/g, ' ').toLowerCase()));
    const existingPhones = new Set(
      existingSchools
        .filter((s) => s.phone && s.phone.trim() !== '')
        .map((s) => normalizeImportPhone(s.phone))
    );

    const seenInBatchNames = new Set<string>();
    const seenInBatchPhones = new Set<string>();

    const preview: ImportPreviewRow[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i] as Record<string, unknown>;
      const mappedRow = mapSchoolImportRow(row, headerResolution);
      const employee = matchImportEmployee(mappedRow.contactPerson, employees);
      const employeeError = mappedRow.contactPerson && !employee ? ['responsibleEmployee: Responsible employee was not found'] : [];
      // The Excel "اسم المتابع" value identifies the school's responsible employee.
      // It must not be copied into School.contactPerson, which represents the
      // external contact at the school.
      const parsed = schoolImportRowSchema.safeParse({ ...mappedRow, contactPerson: null, responsibleEmployeeId: employee?.id ?? null });

      if (!parsed.success || employeeError.length) {
        const errorMessages = [...(parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)), ...employeeError];
        preview.push({
          index: i + 1,
          data: {
            ...mappedRow,
            contactPerson: null,
            responsibleEmployee: employee?.name ?? mappedRow.contactPerson,
            city: mappedRow.city || '',
          },
          status: 'invalid',
          errors: errorMessages,
        });
        invalidCount++;
        continue;
      }

      const schoolData = { ...parsed.data, contactPerson: null, responsibleEmployee: employee?.name ?? mappedRow.contactPerson, city: parsed.data.city || 'Amman' };
      const normalizedName = schoolData.name.trim().replace(/\s+/g, ' ').toLowerCase();
      const rawPhone = schoolData.phone ? normalizeImportPhone(schoolData.phone) : null;

      // Duplicate Check against DB or batch
      if (existingNames.has(normalizedName) || seenInBatchNames.has(normalizedName)) {
        preview.push({
          index: i + 1,
          data: schoolData,
          status: 'duplicate',
          duplicateReason: `Duplicate school name: "${schoolData.name}" already exists`,
        });
        duplicateCount++;
        continue;
      }

      if (rawPhone && rawPhone.length > 5 && (existingPhones.has(rawPhone) || seenInBatchPhones.has(rawPhone))) {
        preview.push({
          index: i + 1,
          data: schoolData,
          status: 'duplicate',
          duplicateReason: `Duplicate phone number: "${schoolData.phone}" already exists`,
        });
        duplicateCount++;
        continue;
      }

      seenInBatchNames.add(normalizedName);
      if (rawPhone && rawPhone.length > 5) seenInBatchPhones.add(rawPhone);

      preview.push({
        index: i + 1,
        data: schoolData,
        status: 'valid',
      });
      validCount++;
    }

    return {
      preview,
      validCount,
      invalidCount,
      duplicateCount,
      detectedColumns: Object.keys(rawRows[0] || {}),
      mappedColumns: Object.fromEntries(headerResolution.mapped),
      ignoredColumns: Array.from(headerResolution.ignored.values()),
      missingOptionalColumns: headerResolution.missingOptional,
    };
  }

  /**
   * Performs bulk insertion of validated rows in a transaction.
   */
  static async executeBulkImport(validRows: any[], actorId: string, metadata?: { fileName?: string; skippedCount?: number; failedCount?: number; duplicateCount?: number }) {
    if (validRows.length === 0) {
      throw new Error('No valid records to import');
    }
    if (validRows.length > 5000) throw new Error('The maximum allowed import size is 5,000 rows');
    const parsedRows = validRows.map((row) => schoolImportRowSchema.safeParse(row));
    const invalidRow = parsedRows.find((result) => !result.success);
    if (invalidRow && !invalidRow.success) throw new Error('Import validation failed. Please review the file preview and try again.');

    // The preview is client-visible and must not be trusted as the source of
    // the responsible-employee relationship. Re-check every referenced user
    // at commit time so an import can never create a new user or attach a
    // school to a deleted/inactive account through a forged payload.
    const responsibleEmployeeIds = Array.from(new Set(
      parsedRows
        .filter((result): result is { success: true; data: any } => result.success)
        .map((result) => result.data.responsibleEmployeeId)
        .filter((id): id is string => Boolean(id))
    ));
    const activeEmployees = responsibleEmployeeIds.length
      ? await prisma.user.findMany({
          where: { id: { in: responsibleEmployeeIds }, isActive: true },
          select: { id: true },
        })
      : [];
    const activeEmployeeIds = new Set(activeEmployees.map((employee) => employee.id));
    if (responsibleEmployeeIds.some((id) => !activeEmployeeIds.has(id))) {
      throw new Error('One or more responsible employees are no longer active. Please re-run the import preview.');
    }

    const createdSchools = await prisma.$transaction(async (tx) => {
      const existing = await tx.school.findMany({ select: { name: true, phone: true } });
      const names = new Set(existing.map((school) => school.name.trim().replace(/\s+/g, ' ').toLowerCase()));
      const phones = new Set(existing.filter((school) => school.phone).map((school) => normalizeImportPhone(school.phone)));
      const batchNames = new Set<string>();
      const batchPhones = new Set<string>();
      for (const result of parsedRows) {
        if (!result.success) throw new Error('Import validation failed.');
        const row = result.data;
        const name = row.name.trim().replace(/\s+/g, ' ').toLowerCase();
        const phone = row.phone ? normalizeImportPhone(row.phone) : '';
        if (names.has(name) || batchNames.has(name) || (phone && (phones.has(phone) || batchPhones.has(phone)))) {
          throw new Error(`Duplicate school detected: ${row.name}`);
        }
        batchNames.add(name);
        if (phone) batchPhones.add(phone);
      }
      return Promise.all(
        parsedRows.map((result) => {
          if (!result.success) throw new Error('Import validation failed.');
          const row = result.data;
          return tx.school.create({
            data: {
              name: row.name,
              contactPerson: row.contactPerson || null,
              phone: row.phone || null,
              email: row.email || null,
              city: row.city || 'Amman',
              classification: row.classification,
              responsibleEmployeeId: row.responsibleEmployeeId || null,
              createdById: actorId,
            },
          });
        })
      );
    });
    await AuditService.logAudit({
      actorId,
      action: 'SCHOOL_BULK_IMPORTED',
      entityType: 'School',
      metadata: { importedCount: createdSchools.length, fileName: metadata?.fileName, skippedCount: metadata?.skippedCount || 0, failedCount: metadata?.failedCount || 0, duplicateCount: metadata?.duplicateCount || 0 },
    });

    return {
      success: true,
      importedCount: createdSchools.length,
    };
  }
}
