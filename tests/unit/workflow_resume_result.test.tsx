// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  resume: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/lib/auth/session', () => ({ requireAuth: async () => ({ id: 'user-a', organizationId: 'org-a', permissions: ['workflows.execute'] }) }));
vi.mock('@/lib/permissions', () => ({ hasPermission: () => true, PERMISSIONS: { WORKFLOWS_EXECUTE: 'workflows.execute' } }));
vi.mock('@/server/services/WorkflowService', () => ({ WorkflowService: { resume: mocks.resume } }));

import { ResumeWorkflowExecutionButton } from '@/components/workflows/ResumeWorkflowExecutionButton';
import { resumeWorkflowExecutionAction } from '@/server/actions/workflows';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('workflow resume result reporting', () => {
  it('returns a nested WorkflowService failure as a failed server action', async () => {
    mocks.resume.mockResolvedValueOnce({ status: 'FAILED', error: 'deliberate workflow failure' });

    await expect(resumeWorkflowExecutionAction('execution-a')).resolves.toMatchObject({
      success: false,
      error: 'deliberate workflow failure',
      result: { status: 'FAILED' },
    });
  });

  it('shows the nested resume failure instead of treating it as success', async () => {
    mocks.resume.mockResolvedValueOnce({ status: 'NON_RESUMABLE', error: 'Workflow execution has no safe resumable checkpoint' });
    render(<ResumeWorkflowExecutionButton executionId="execution-a" />);

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));

    expect(await screen.findByText('Workflow execution has no safe resumable checkpoint')).toBeTruthy();
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });
});
