// Stub for Gemini integration.
// You can replace this with real Google Gemini API call later.
export async function processScanRequest(c) {
  const body = await c.req.json().catch(() => ({}))
  const user = c.get('user') || null

  return {
    message: 'Scan processed (stub implementation)',
    received: body,
    user
  }
}
