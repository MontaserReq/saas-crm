import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { ComingSoonPanel } from "@/components/ai-school-research/ComingSoonPanel";
import { LeadDiscoveryView } from "@/components/lead-discovery/LeadDiscoveryView";
import { LeadDiscoveryService } from "@/server/services/LeadDiscoveryService";
import { getAiResearchPlatformSettings } from "@/lib/ai/researchSettings";
import { getOrganizationAiUsageSummary } from "@/lib/ai/organizationPolicy";
import { headers } from "next/headers";

export default async function AiSchoolResearchPage() {
  const user = (await getCurrentUser())!;
  if (!hasPermission(user, PERMISSIONS.AI_RESEARCH_VIEW)) return null;
  const settings = await getAiResearchPlatformSettings();
  if (settings.status === "OFF")
    return <ComingSoonPanel status={settings.status} />;

  const jobs = await LeadDiscoveryService.listJobs(user);
  const isConfigured = settings.providers.some(
    (provider) => provider.enabled && provider.apiKey && ["gemini", "groq"].includes(provider.kind),
  );
  const usage = user.organizationId ? await getOrganizationAiUsageSummary(user.organizationId) : null;
  const language =
    (await headers()).get("x-satrcrm-locale") === "en" ? "en" : "ar";
  return (
    <LeadDiscoveryView
      initialJobs={jobs.map((job) => ({
        id: job.id,
        prompt: job.prompt,
        status: job.status,
        stage: job.stage,
        requestedCount: job.requestedCount,
        createdAt: job.createdAt.toISOString(),
        _count: job._count,
      }))}
      canImport={hasPermission(user, PERMISSIONS.AI_RESEARCH_APPROVE)}
      canCreate={
        isConfigured &&
        hasPermission(user, PERMISSIONS.AI_RESEARCH_CREATE) &&
        hasPermission(user, PERMISSIONS.AI_RESEARCH_RUN)
      }
      language={language}
      featureStatus={settings.status}
      setup={{ aiConfigured: isConfigured }}
      usage={usage ? { ai: usage.ai } : null}
    />
  );
}
