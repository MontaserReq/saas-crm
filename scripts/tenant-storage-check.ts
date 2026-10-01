import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { getStorageProvider, resetStorageProviderForTests } from '../src/lib/storage';

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sass-crm-tenant-storage-'));
  process.env.STORAGE_LOCAL_DIR = root;
  resetStorageProviderForTests();
  const storage = getStorageProvider('local');
  const body = Buffer.from('tenant-isolation-test');
  const a = await storage.upload(body, 'a.txt', 'text/plain', { keyPrefix: 'tenant-org-a/tickets' });
  const b = await storage.upload(body, 'b.txt', 'text/plain', { keyPrefix: 'tenant-org-b/messages' });
  const aRead = await storage.download(a.storageKey);
  const bRead = await storage.download(b.storageKey);
  const aUrl = await storage.getDownloadUrl(a.storageKey, 300);
  const deletedA = await storage.delete(a.storageKey);
  const deletedB = await storage.delete(b.storageKey);
  console.log(JSON.stringify({ provider: storage.providerId, keysOrganizationPrefixed: a.storageKey.startsWith('tenant-org-a/') && b.storageKey.startsWith('tenant-org-b/'), uploadDownload: aRead?.equals(body) === true && bRead?.equals(body) === true, localPreviewOrDownloadUrl: aUrl.includes(encodeURIComponent(a.storageKey)), delete: deletedA && deletedB }));
  await fs.rm(root, { recursive: true, force: true });
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
