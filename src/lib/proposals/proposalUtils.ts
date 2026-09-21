export function formatProposalCode(proposal: { id: string; createdAt?: Date | string | null }): string {
  const year = proposal.createdAt ? new Date(proposal.createdAt).getFullYear() : new Date().getFullYear();
  const shortId = (proposal.id || '').slice(-6).toUpperCase();
  return `PROP-${year}-${shortId}`;
}
