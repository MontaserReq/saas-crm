import type { Prisma } from '@prisma/client';

type SequenceClient = Pick<Prisma.TransactionClient, '$queryRaw'>;

async function nextSequenceValue(client: SequenceClient, sequence: 'TicketNumberSequence' | 'AssignmentBatchNumberSequence') {
  const rows = sequence === 'TicketNumberSequence'
    ? await client.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('"TicketNumberSequence"') AS value`
    : await client.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('"AssignmentBatchNumberSequence"') AS value`;
  const value = rows[0]?.value;
  if (value === undefined) throw new Error('Identifier sequence did not return a value');
  return Number(value);
}

export async function nextTicketNumber(client: SequenceClient): Promise<string> {
  const value = await nextSequenceValue(client, 'TicketNumberSequence');
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Ticket identifier sequence is invalid');
  return `CL-${String(value).padStart(5, '0')}`;
}

export async function nextAssignmentBatchNumber(client: SequenceClient, date = new Date()): Promise<string> {
  const value = await nextSequenceValue(client, 'AssignmentBatchNumberSequence');
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Assignment identifier sequence is invalid');
  return `ASN-${date.getUTCFullYear()}-${String(value).padStart(4, '0')}`;
}
