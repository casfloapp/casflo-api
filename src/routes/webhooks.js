import { Hono } from 'hono';
import { verifyWebhookSignature, asyncHandler } from '../middleware/security.js';
import { WebhookService } from '../services/webhook.js';

const webhookRoutes = new Hono();

// Initialize webhook service
const getWebhookService = (c) => new WebhookService(c.env);

// GitHub webhook handler
webhookRoutes.post('/github',
  verifyWebhookSignature,
  asyncHandler(async (c) => {
    const webhookService = getWebhookService(c);
    const body = c.get('webhookBody');
    const signature = c.req.header('X-Hub-Signature-256');
    
    const result = await webhookService.handleGitHubWebhook(body, signature);
    
    return c.json({
      success: true,
      message: 'GitHub webhook processed successfully',
      data: result
    });
  })
);

// Stripe webhook handler
webhookRoutes.post('/stripe',
  verifyWebhookSignature,
  asyncHandler(async (c) => {
    const webhookService = getWebhookService(c);
    const body = c.get('webhookBody');
    const signature = c.req.header('Stripe-Signature');
    
    const result = await webhookService.handleStripeWebhook(body, signature);
    
    return c.json({
      success: true,
      message: 'Stripe webhook processed successfully',
      data: result
    });
  })
);

// Custom webhook handler
webhookRoutes.post('/custom/:event',
  asyncHandler(async (c) => {
    const { event } = c.req.param();
    const webhookService = getWebhookService(c);
    const body = await c.req.json();
    
    const result = await webhookService.handleCustomWebhook(event, body);
    
    return c.json({
      success: true,
      message: 'Custom webhook processed successfully',
      data: result
    });
  })
);

// Email webhook handler (for email delivery confirmations)
webhookRoutes.post('/email',
  verifyWebhookSignature,
  asyncHandler(async (c) => {
    const webhookService = getWebhookService(c);
    const body = c.get('webhookBody');
    
    const result = await webhookService.handleEmailWebhook(body);
    
    return c.json({
      success: true,
      message: 'Email webhook processed successfully',
      data: result
    });
  })
);

// SMS webhook handler (for SMS delivery confirmations)
webhookRoutes.post('/sms',
  verifyWebhookSignature,
  asyncHandler(async (c) => {
    const webhookService = getWebhookService(c);
    const body = c.get('webhookBody');
    
    const result = await webhookService.handleSMSWebhook(body);
    
    return c.json({
      success: true,
      message: 'SMS webhook processed successfully',
      data: result
    });
  })
);

// Payment webhook handler
webhookRoutes.post('/payment',
  verifyWebhookSignature,
  asyncHandler(async (c) => {
    const webhookService = getWebhookService(c);
    const body = c.get('webhookBody');
    
    const result = await webhookService.handlePaymentWebhook(body);
    
    return c.json({
      success: true,
      message: 'Payment webhook processed successfully',
      data: result
    });
  })
);

// Analytics webhook handler
webhookRoutes.post('/analytics',
  verifyWebhookSignature,
  asyncHandler(async (c) => {
    const webhookService = getWebhookService(c);
    const body = c.get('webhookBody');
    
    const result = await webhookService.handleAnalyticsWebhook(body);
    
    return c.json({
      success: true,
      message: 'Analytics webhook processed successfully',
      data: result
    });
  })
);

// User activity webhook handler
webhookRoutes.post('/user-activity',
  verifyWebhookSignature,
  asyncHandler(async (c) => {
    const webhookService = getWebhookService(c);
    const body = c.get('webhookBody');
    
    const result = await webhookService.handleUserActivityWebhook(body);
    
    return c.json({
      success: true,
      message: 'User activity webhook processed successfully',
      data: result
    });
  })
);

// System monitoring webhook handler
webhookRoutes.post('/monitoring',
  verifyWebhookSignature,
  asyncHandler(async (c) => {
    const webhookService = getWebhookService(c);
    const body = c.get('webhookBody');
    
    const result = await webhookService.handleMonitoringWebhook(body);
    
    return c.json({
      success: true,
      message: 'Monitoring webhook processed successfully',
      data: result
    });
  })
);

// Backup webhook handler
webhookRoutes.post('/backup',
  verifyWebhookSignature,
  asyncHandler(async (c) => {
    const webhookService = getWebhookService(c);
    const body = c.get('webhookBody');
    
    const result = await webhookService.handleBackupWebhook(body);
    
    return c.json({
      success: true,
      message: 'Backup webhook processed successfully',
      data: result
    });
  })
);

// Generic webhook handler for testing
webhookRoutes.post('/test',
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const headers = Object.fromEntries(c.req.header());
    
    // Log webhook for debugging
    console.log('Test webhook received:', {
      headers,
      body,
      timestamp: new Date().toISOString()
    });
    
    return c.json({
      success: true,
      message: 'Test webhook received successfully',
      data: {
        received: true,
        timestamp: new Date().toISOString(),
        body
      }
    });
  })
);

export default webhookRoutes;