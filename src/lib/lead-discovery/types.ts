import { z } from 'zod';

export const leadDiscoveryExtractionSchema = z.object({
  company_name: z.string().min(1).max(300),
  website: z.string().url().nullable().optional(),
  industry: z.string().max(200).nullable().optional(),
  business_description: z.string().max(2000).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  phone: z.string().max(100).nullable().optional(),
  email: z.string().email().nullable().optional(),
  linkedin: z.string().url().nullable().optional(),
  instagram: z.string().url().nullable().optional(),
  company_size: z.string().max(120).nullable().optional(),
  qualification_reason: z.string().max(1000).nullable().optional(),
  verification_status: z.enum(['verified', 'partially_verified', 'unverified']).optional(),
  sources: z.array(z.object({ url: z.string().url(), field: z.string().max(80), evidence: z.string().max(500) })).max(12).default([]),
});

export type LeadDiscoveryExtraction = z.infer<typeof leadDiscoveryExtractionSchema>;

export type LeadDiscoveryIntent = {
  industry: string | null;
  country: string | null;
  city: string | null;
  companySize: string | null;
  requestedCount: number;
  requiredFields: string[];
};
