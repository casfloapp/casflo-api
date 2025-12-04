# Webhook Service for handling external integrations
export class WebhookService {
  constructor(env) {
    this.env = env;
  }

  async handleGitHubWebhook(body, signature) {
    const event = this.env.req.header('X-GitHub-Event');
    const delivery = this.env.req.header('X-GitHub-Delivery');

    Logger.info('GitHub webhook received', {
      event,
      delivery,
      timestamp: new Date().toISOString()
    });

    // Process different GitHub events
    switch (event) {
      case 'push':
        return await this.handleGitHubPush(body);
      case 'pull_request':
        return await this.handleGitHubPullRequest(body);
      case 'release':
        return await this.handleGitHubRelease(body);
      default:
        return { processed: false, event, message: 'Event not handled' };
    }
  }

  async handleGitHubPush(body) {
    const { ref, commits, repository } = body;
    
    // Log deployment or code changes
    await this.logAuditEvent('GITHUB_PUSH', 'repository', {
      repository: repository.full_name,
      ref,
      commitsCount: commits.length,
      timestamp: new Date().toISOString()
    });

    return {
      processed: true,
      event: 'push',
      repository: repository.full_name,
      commits: commits.length
    };
  }

  async handleGitHubPullRequest(body) {
    const { action, pull_request, repository } = body;
    
    await this.logAuditEvent('GITHUB_PR', 'pull_request', {
      repository: repository.full_name,
      action,
      prNumber: pull_request.number,
      title: pull_request.title,
      timestamp: new Date().toISOString()
    });

    return {
      processed: true,
      event: 'pull_request',
      action,
      repository: repository.full_name
    };
  }

  async handleGitHubRelease(body) {
    const { action, release, repository } = body;
    
    await this.logAuditEvent('GITHUB_RELEASE', 'release', {
      repository: repository.full_name,
      action,
      tagName: release.tag_name,
      name: release.name,
      timestamp: new Date().toISOString()
    });

    return {
      processed: true,
      event: 'release',
      action,
      repository: repository.full_name,
      tag: release.tag_name
    };
  }

  async handleStripeWebhook(body, signature) {
    const event = JSON.parse(body).type;
    
    Logger.info('Stripe webhook received', {
      event,
      timestamp: new Date().toISOString()
    });

    switch (event) {
      case 'payment_intent.succeeded':
        return await this.handleStripePaymentSucceeded(JSON.parse(body).data.object);
      case 'payment_intent.payment_failed':
        return await this.handleStripePaymentFailed(JSON.parse(body).data.object);
      case 'customer.subscription.created':
        return await this.handleStripeSubscriptionCreated(JSON.parse(body).data.object);
      case 'customer.subscription.deleted':
        return await this.handleStripeSubscriptionDeleted(JSON.parse(body).data.object);
      default:
        return { processed: false, event, message: 'Event not handled' };
    }
  }

  async handleStripePaymentSucceeded(paymentIntent) {
    await this.logAuditEvent('STRIPE_PAYMENT', 'payment', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      timestamp: new Date().toISOString()
    });

    // Update user subscription or credits
    if (paymentIntent.metadata?.userId) {
      await this.updateUserCredits(paymentIntent.metadata.userId, paymentIntent.amount);
    }

    return {
      processed: true,
      event: 'payment_succeeded',
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount
    };
  }

  async handleStripePaymentFailed(paymentIntent) {
    await this.logAuditEvent('STRIPE_PAYMENT_FAILED', 'payment', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      lastPaymentError: paymentIntent.last_payment_error,
      timestamp: new Date().toISOString()
    });

    return {
      processed: true,
      event: 'payment_failed',
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount
    };
  }

  async handleStripeSubscriptionCreated(subscription) {
    await this.logAuditEvent('STRIPE_SUBSCRIPTION', 'subscription', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
      priceId: subscription.items.data[0]?.price?.id,
      timestamp: new Date().toISOString()
    });

    // Update user subscription status
    if (subscription.metadata?.userId) {
      await this.updateUserSubscription(subscription.metadata.userId, subscription);
    }

    return {
      processed: true,
      event: 'subscription_created',
      subscriptionId: subscription.id,
      status: subscription.status
    };
  }

  async handleStripeSubscriptionDeleted(subscription) {
    await this.logAuditEvent('STRIPE_SUBSCRIPTION_CANCELLED', 'subscription', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
      timestamp: new Date().toISOString()
    });

    // Update user subscription status
    if (subscription.metadata?.userId) {
      await this.cancelUserSubscription(subscription.metadata.userId);
    }

    return {
      processed: true,
      event: 'subscription_deleted',
      subscriptionId: subscription.id
    };
  }

  async handleCustomWebhook(event, body) {
    Logger.info('Custom webhook received', {
      event,
      timestamp: new Date().toISOString()
    });

    await this.logAuditEvent('CUSTOM_WEBHOOK', 'webhook', {
      event,
      body,
      timestamp: new Date().toISOString()
    });

    // Process custom events based on event type
    switch (event) {
      case 'user.created':
        return await this.handleUserCreated(body);
      case 'user.updated':
        return await this.handleUserUpdated(body);
      case 'book.created':
        return await this.handleBookCreated(body);
      case 'transaction.created':
        return await this.handleTransactionCreated(body);
      default:
        return { processed: false, event, message: 'Custom event not handled' };
    }
  }

  async handleUserCreated(userData) {
    // Send welcome email, create default data, etc.
    Logger.info('Processing user created webhook', { userId: userData.id });
    
    return {
      processed: true,
      event: 'user_created',
      userId: userData.id
    };
  }

  async handleUserUpdated(userData) {
    // Update user cache, send notifications, etc.
    Logger.info('Processing user updated webhook', { userId: userData.id });
    
    return {
      processed: true,
      event: 'user_updated',
      userId: userData.id
    };
  }

  async handleBookCreated(bookData) {
    // Initialize book with default categories, send notifications, etc.
    Logger.info('Processing book created webhook', { bookId: bookData.id });
    
    return {
      processed: true,
      event: 'book_created',
      bookId: bookData.id
    };
  }

  async handleTransactionCreated(transactionData) {
    // Update analytics, send notifications, etc.
    Logger.info('Processing transaction created webhook', { 
      transactionId: transactionData.id,
      bookId: transactionData.bookId 
    });
    
    return {
      processed: true,
      event: 'transaction_created',
      transactionId: transactionData.id
    };
  }

  async handleEmailWebhook(body) {
    const { event, data } = body;
    
    Logger.info('Email webhook received', {
      event,
      timestamp: new Date().toISOString()
    });

    switch (event) {
      case 'delivered':
        return await this.handleEmailDelivered(data);
      case 'bounced':
        return await this.handleEmailBounced(data);
      case 'complained':
        return await this.handleEmailComplained(data);
      case 'unsubscribed':
        return await this.handleEmailUnsubscribed(data);
      default:
        return { processed: false, event, message: 'Email event not handled' };
    }
  }

  async handleEmailDelivered(data) {
    await this.logAuditEvent('EMAIL_DELIVERED', 'email', {
      messageId: data.messageId,
      recipient: data.recipient,
      timestamp: new Date().toISOString()
    });

    return {
      processed: true,
      event: 'email_delivered',
      messageId: data.messageId
    };
  }

  async handleEmailBounced(data) {
    await this.logAuditEvent('EMAIL_BOUNCED', 'email', {
      messageId: data.messageId,
      recipient: data.recipient,
      reason: data.reason,
      timestamp: new Date().toISOString()
    });

    // Update user email status
    if (data.recipient) {
      await this.updateUserEmailStatus(data.recipient, 'bounced');
    }

    return {
      processed: true,
      event: 'email_bounced',
      messageId: data.messageId,
      recipient: data.recipient
    };
  }

  async handleEmailComplained(data) {
    await this.logAuditEvent('EMAIL_COMPLAINED', 'email', {
      messageId: data.messageId,
      recipient: data.recipient,
      timestamp: new Date().toISOString()
    });

    // Unsubscribe user from marketing emails
    if (data.recipient) {
      await this.updateUserEmailPreferences(data.recipient, { marketing: false });
    }

    return {
      processed: true,
      event: 'email_complained',
      messageId: data.messageId
    };
  }

  async handleEmailUnsubscribed(data) {
    await this.logAuditEvent('EMAIL_UNSUBSCRIBED', 'email', {
      messageId: data.messageId,
      recipient: data.recipient,
      timestamp: new Date().toISOString()
    });

    // Update user email preferences
    if (data.recipient) {
      await this.updateUserEmailPreferences(data.recipient, { all: false });
    }

    return {
      processed: true,
      event: 'email_unsubscribed',
      messageId: data.messageId
    };
  }

  async handleSMSWebhook(body) {
    const { event, data } = body;
    
    Logger.info('SMS webhook received', {
      event,
      timestamp: new Date().toISOString()
    });

    switch (event) {
      case 'sent':
        return await this.handleSMSSent(data);
      case 'delivered':
        return await this.handleSMSDelivered(data);
      case 'failed':
        return await this.handleSMSFailed(data);
      default:
        return { processed: false, event, message: 'SMS event not handled' };
    }
  }

  async handleSMSSent(data) {
    await this.logAuditEvent('SMS_SENT', 'sms', {
      messageId: data.messageId,
      recipient: data.recipient,
      timestamp: new Date().toISOString()
    });

    return {
      processed: true,
      event: 'sms_sent',
      messageId: data.messageId
    };
  }

  async handleSMSDelivered(data) {
    await this.logAuditEvent('SMS_DELIVERED', 'sms', {
      messageId: data.messageId,
      recipient: data.recipient,
      timestamp: new Date().toISOString()
    });

    return {
      processed: true,
      event: 'sms_delivered',
      messageId: data.messageId
    };
  }

  async handleSMSFailed(data) {
    await this.logAuditEvent('SMS_FAILED', 'sms', {
      messageId: data.messageId,
      recipient: data.recipient,
      reason: data.reason,
      timestamp: new Date().toISOString()
    });

    return {
      processed: true,
      event: 'sms_failed',
      messageId: data.messageId,
      reason: data.reason
    };
  }

  async handlePaymentWebhook(body) {
    const { event, data } = body;
    
    Logger.info('Payment webhook received', {
      event,
      timestamp: new Date().toISOString()
    });

    switch (event) {
      case 'payment.completed':
        return await this.handlePaymentCompleted(data);
      case 'payment.failed':
        return await this.handlePaymentFailed(data);
      case 'refund.processed':
        return await this.handleRefundProcessed(data);
      default:
        return { processed: false, event, message: 'Payment event not handled' };
    }
  }

  async handlePaymentCompleted(data) {
    await this.logAuditEvent('PAYMENT_COMPLETED', 'payment', {
      paymentId: data.paymentId,
      amount: data.amount,
      currency: data.currency,
      userId: data.userId,
      timestamp: new Date().toISOString()
    });

    // Update user credits or subscription
    if (data.userId) {
      await this.updateUserCredits(data.userId, data.amount);
    }

    return {
      processed: true,
      event: 'payment_completed',
      paymentId: data.paymentId,
      amount: data.amount
    };
  }

  async handlePaymentFailed(data) {
    await this.logAuditEvent('PAYMENT_FAILED', 'payment', {
      paymentId: data.paymentId,
      amount: data.amount,
      reason: data.reason,
      userId: data.userId,
      timestamp: new Date().toISOString()
    });

    return {
      processed: true,
      event: 'payment_failed',
      paymentId: data.paymentId,
      reason: data.reason
    };
  }

  async handleRefundProcessed(data) {
    await this.logAuditEvent('REFUND_PROCESSED', 'refund', {
      refundId: data.refundId,
      amount: data.amount,
      originalPaymentId: data.originalPaymentId,
      timestamp: new Date().toISOString()
    });

    return {
      processed: true,
      event: 'refund_processed',
      refundId: data.refundId,
      amount: data.amount
    };
  }

  async handleAnalyticsWebhook(body) {
    const { event, data } = body;
    
    Logger.info('Analytics webhook received', {
      event,
      timestamp: new Date().toISOString()
    });

    // Process analytics data
    await this.processAnalyticsData(event, data);

    return {
      processed: true,
      event,
      dataPoints: Array.isArray(data) ? data.length : 1
    };
  }

  async handleUserActivityWebhook(body) {
    const { event, data } = body;
    
    Logger.info('User activity webhook received', {
      event,
      timestamp: new Date().toISOString()
    });

    // Log user activity
    await this.logUserActivity(event, data);

    return {
      processed: true,
      event,
      userId: data.userId
    };
  }

  async handleMonitoringWebhook(body) {
    const { event, data } = body;
    
    Logger.info('Monitoring webhook received', {
      event,
      timestamp: new Date().toISOString()
    });

    // Process monitoring alerts
    await this.processMonitoringAlert(event, data);

    return {
      processed: true,
      event,
      severity: data.severity || 'info'
    };
  }

  async handleBackupWebhook(body) {
    const { event, data } = body;
    
    Logger.info('Backup webhook received', {
      event,
      timestamp: new Date().toISOString()
    });

    // Process backup events
    await this.processBackupEvent(event, data);

    return {
      processed: true,
      event,
      backupId: data.backupId
    };
  }

  // Helper methods
  async logAuditEvent(action, resourceType, details) {
    try {
      await this.env.DB.prepare(`
        INSERT INTO audit_logs (id, action, resource_type, resource_id, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        `audit_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        action,
        resourceType,
        details.id || null,
        JSON.stringify(details),
        new Date().toISOString()
      ).run();
    } catch (error) {
      Logger.error('Failed to log audit event', error);
    }
  }

  async logUserActivity(event, data) {
    try {
      await this.env.DB.prepare(`
        INSERT INTO user_activity_logs (id, user_id, action, resource, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        `activity_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        data.userId,
        event,
        data.resource || null,
        JSON.stringify(data),
        new Date().toISOString()
      ).run();
    } catch (error) {
      Logger.error('Failed to log user activity', error);
    }
  }

  async updateUserCredits(userId, amount) {
    // Update user credits or subscription
    Logger.info('Updating user credits', { userId, amount });
  }

  async updateUserSubscription(userId, subscription) {
    // Update user subscription status
    Logger.info('Updating user subscription', { userId, subscriptionId: subscription.id });
  }

  async cancelUserSubscription(userId) {
    // Cancel user subscription
    Logger.info('Cancelling user subscription', { userId });
  }

  async updateUserEmailStatus(email, status) {
    // Update user email delivery status
    Logger.info('Updating user email status', { email, status });
  }

  async updateUserEmailPreferences(email, preferences) {
    // Update user email preferences
    Logger.info('Updating user email preferences', { email, preferences });
  }

  async processAnalyticsData(event, data) {
    // Process analytics data for reporting
    Logger.info('Processing analytics data', { event, dataPoints: Array.isArray(data) ? data.length : 1 });
  }

  async processMonitoringAlert(event, data) {
    // Process monitoring alerts and notifications
    Logger.info('Processing monitoring alert', { event, severity: data.severity });
  }

  async processBackupEvent(event, data) {
    // Process backup events
    Logger.info('Processing backup event', { event, backupId: data.backupId });
  }
}

export default WebhookService;