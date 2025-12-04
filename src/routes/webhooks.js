import { Hono } from 'hono'

export const webhookRoutes = new Hono()

webhookRoutes.post('/generic', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  console.log('Webhook received:', body)
  return c.json({ received: true })
})
