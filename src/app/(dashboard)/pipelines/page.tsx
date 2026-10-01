import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { PipelineService } from '@/server/services/PipelineService';
import { PipelinesView } from '@/components/pipelines/PipelinesView';
export default async function PipelinesPage() { const user = await requireAuth(); if (!hasPermission(user, PERMISSIONS.PIPELINES_VIEW)) return null; return <PipelinesView pipelines={await PipelineService.list(user)} />; }
