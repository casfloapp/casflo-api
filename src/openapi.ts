export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Casflo API (Worker)',
    version: '1.0.0',
    description: 'Personal finance API running on Cloudflare Worker + D1'
  },
  paths: {
    '/auth/register': { post: { summary: 'Register user' } },
    '/auth/login': { post: { summary: 'Login' } },
    '/auth/refresh': { post: { summary: 'Refresh token' } },
    '/users/me': { get: { summary: 'Get current user profile' } },
    '/categories': { get: { summary: 'List categories' } },
    '/transactions': { get: { summary: 'List transactions' } },
    '/reports/summary': { get: { summary: 'Get summary report' } }
  }
};
