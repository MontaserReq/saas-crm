import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadOptions { keyPrefix?: string }
export interface UploadResult { storageKey: string; size: number; mimeType: string; originalName: string }
export interface StorageProvider {
  readonly name: string; readonly providerId: 'local' | 's3';
  upload(buffer: Buffer, originalName: string, mimeType: string, options?: UploadOptions): Promise<UploadResult>;
  download(key: string): Promise<Buffer | null>; delete(key: string): Promise<boolean>; exists(key: string): Promise<boolean>;
  getDownloadUrl(key: string, expiresIn?: number): Promise<string>;
  healthCheck(): Promise<{ connected: boolean; provider: string; bucket?: string; region?: string; error?: string }>;
}
const filename = (name: string) => path.basename(name).normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'file';
const keyFor = (name: string, prefix = 'attachments') => { const d = new Date(); const p = prefix.replace(/[^a-zA-Z0-9/_-]+/g, '').replace(/^\/+|\/+$/g, '') || 'attachments'; return `${p}/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}-${filename(name)}`; };

class LocalStorageProvider implements StorageProvider {
  readonly name = 'Local filesystem'; readonly providerId = 'local' as const;
  private root = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR || './uploads');
  constructor() { fs.mkdirSync(this.root, { recursive: true }); }
  private resolve(key: string) { const clean = key.replace(/\\/g, '/').replace(/^\/+/, ''); if (!clean || clean.split('/').some((p) => p === '..' || p === '.')) throw new Error('Invalid storage key'); const r = path.resolve(this.root, ...clean.split('/')); if (!r.startsWith(this.root + path.sep)) throw new Error('Invalid storage key'); return r; }
  async upload(buffer: Buffer, originalName: string, mimeType: string, options?: UploadOptions) { const storageKey = keyFor(originalName, options?.keyPrefix); const target = this.resolve(storageKey); await fs.promises.mkdir(path.dirname(target), { recursive: true }); await fs.promises.writeFile(target, buffer, { flag: 'wx' }); return { storageKey, originalName: filename(originalName), mimeType, size: buffer.length }; }
  async download(key: string) { try { return await fs.promises.readFile(this.resolve(key)); } catch (e: any) { if (e.code === 'ENOENT') return null; throw e; } }
  async delete(key: string) { try { await fs.promises.unlink(this.resolve(key)); return true; } catch (e: any) { if (e.code === 'ENOENT') return false; throw e; } }
  async exists(key: string) { try { await fs.promises.access(this.resolve(key)); return true; } catch { return false; } }
  async getDownloadUrl(key: string) { return `/api/storage/local/${encodeURIComponent(key)}`; }
  async healthCheck() { return { connected: true, provider: this.name }; }
}

class S3StorageProvider implements StorageProvider {
  readonly name = 'Hetzner Object Storage (S3)'; readonly providerId = 's3' as const; private client: S3Client; private bucket: string; private region: string;
  constructor() { const v = { endpoint: process.env.S3_ENDPOINT?.trim(), region: process.env.S3_REGION?.trim(), access: process.env.S3_ACCESS_KEY?.trim(), secret: process.env.S3_SECRET_KEY?.trim(), bucket: process.env.S3_BUCKET?.trim() }; const missing = Object.entries(v).filter(([, x]) => !x).map(([k]) => k === 'access' ? 'S3_ACCESS_KEY' : k === 'secret' ? 'S3_SECRET_KEY' : `S3_${k.toUpperCase()}`); if (missing.length) throw new Error(`S3 storage configuration is incomplete. Missing: ${missing.join(', ')}`); this.bucket = v.bucket!; this.region = v.region!; this.client = new S3Client({ endpoint: v.endpoint, region: v.region, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', credentials: { accessKeyId: v.access!, secretAccessKey: v.secret! } }); }
  async upload(buffer: Buffer, originalName: string, mimeType: string, options?: UploadOptions) { const storageKey = keyFor(originalName, options?.keyPrefix); await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: storageKey, Body: buffer, ContentType: mimeType })); return { storageKey, originalName: filename(originalName), mimeType, size: buffer.length }; }
  async download(key: string) { try { const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key })); return r.Body ? Buffer.from(await r.Body.transformToByteArray()) : null; } catch (e: any) { if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return null; throw e; } }
  async delete(key: string) { await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })); return true; }
  async exists(key: string) { try { await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: 'bytes=0-0' })); return true; } catch (e: any) { if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return false; throw e; } }
  async getDownloadUrl(key: string, expiresIn = 300) { return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn }); }
  async healthCheck() { try { await this.client.send(new HeadBucketCommand({ Bucket: this.bucket })); return { connected: true, provider: this.name, bucket: this.bucket, region: this.region }; } catch (e: any) { return { connected: false, provider: this.name, bucket: this.bucket, region: this.region, error: e?.name || 'Storage connection failed' }; } }
}
let provider: StorageProvider | null = null;
export function getStorageProvider(override?: 'local' | 's3') { if (override === 'local') return new LocalStorageProvider(); if (!provider) provider = (process.env.STORAGE_DRIVER || (process.env.S3_ENDPOINT ? 's3' : 'local')).toLowerCase() === 's3' ? new S3StorageProvider() : new LocalStorageProvider(); return provider; }
export async function storageHealthCheck() { return getStorageProvider().healthCheck(); }
export function resetStorageProviderForTests() { provider = null; }
