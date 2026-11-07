import { validateAuthSecret } from '@/lib/auth/config';
import { validateProductionSecurityConfig } from '@/lib/security/runtimeConfig';
import type { Instrumentation } from 'next';
import { reportApplicationException } from '@/lib/monitoring/server';

export async function register() {
  validateAuthSecret();
  if (process.env.NEXT_RUNTIME === 'nodejs') validateProductionSecurityConfig();
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await reportApplicationException(error, {
    source: 'server',
    path: request.path,
    method: request.method,
    route: `${context.routeType}:${context.routePath}`,
    details: { router: context.routerKind, renderSource: context.renderSource },
  });
};
