# Casflo API Enterprise v2.0

Enterprise-grade, secure, and scalable REST API for financial management, built with modern technologies and best practices.

## 🚀 Features

### 🔐 Security & Authentication
- **JWT-based authentication** with refresh tokens
- **Role-based access control** (USER, ADMIN, SUPER_ADMIN)
- **Book-level permissions** (OWNER, ADMIN, MEMBER, VIEWER)
- **API Key authentication** for programmatic access
- **Session management** with device tracking
- **Rate limiting** with configurable windows
- **Webhook signature verification**
- **Password encryption** with bcrypt
- **Email verification** system

### 📊 Financial Management
- **Double-entry bookkeeping** system
- **Multi-currency support**
- **Recurring transactions**
- **Budget tracking**
- **Category management** with hierarchy
- **Contact management** (customers/vendors)
- **Account management** (assets, liabilities, equity)
- **Transaction attachments**
- **Advanced search and filtering**

### 📈 Analytics & Reporting
- **Real-time analytics**
- **Income vs expense trends**
- **Category breakdowns**
- **Cash flow analysis**
- **Budget vs actual reporting**
- **Financial health scoring**
- **Forecasting and predictions**
- **Year-over-year comparisons**
- **Custom dashboards**

### 🛠️ Enterprise Features
- **Multi-tenant architecture**
- **Audit logging** for compliance
- **Webhook integrations**
- **Import/Export functionality** (JSON, CSV)
- **Batch operations**
- **Data backup and restore**
- **System monitoring**
- **Performance metrics**
- **Health checks**

### ⚡ Performance & Scalability
- **Smart caching** with Cloudflare KV
- **Database optimization** with proper indexing
- **Connection pooling**
- **Request/response compression**
- **CDN-ready** static assets
- **Horizontal scaling** support

## 🏗️ Architecture

```
src/
├── controllers/          # Request handlers
├── middleware/           # Security & validation middleware
├── models/              # Database models & business logic
├── routes/              # API route definitions
├── services/            # Business services
├── types/               # TypeScript definitions & schemas
├── utils/               # Utility functions
├── lib/                 # External library integrations
└── index.js             # Application entry point
```

## 📋 API Endpoints

### Authentication
- `POST /api/v2/auth/register` - User registration
- `POST /api/v2/auth/login` - User login
- `POST /api/v2/auth/logout` - User logout
- `POST /api/v2/auth/refresh` - Refresh access token
- `POST /api/v2/auth/verify-email` - Email verification
- `POST /api/v2/auth/forgot-password` - Forgot password
- `POST /api/v2/auth/reset-password` - Reset password
- `GET /api/v2/auth/me` - Get current user

### Users
- `GET /api/v2/users/me` - Get user profile
- `PUT /api/v2/users/me` - Update user profile
- `GET /api/v2/users/me/stats` - User statistics
- `GET /api/v2/users/me/preferences` - User preferences
- `PUT /api/v2/users/me/preferences` - Update preferences

### Books
- `GET /api/v2/books` - List user books
- `POST /api/v2/books` - Create new book
- `GET /api/v2/books/:bookId` - Get book details
- `PUT /api/v2/books/:bookId` - Update book
- `DELETE /api/v2/books/:bookId` - Delete book
- `GET /api/v2/books/:bookId/members` - List book members
- `POST /api/v2/books/:bookId/members` - Add member
- `GET /api/v2/books/:bookId/stats` - Book statistics

### Transactions
- `GET /api/v2/transactions/books/:bookId` - List transactions
- `POST /api/v2/transactions/books/:bookId` - Create transaction
- `GET /api/v2/transactions/books/:bookId/:transactionId` - Get transaction
- `PUT /api/v2/transactions/books/:bookId/:transactionId` - Update transaction
- `DELETE /api/v2/transactions/books/:bookId/:transactionId` - Delete transaction
- `POST /api/v2/transactions/books/:bookId/batch` - Batch create

### Analytics
- `GET /api/v2/analytics/books/:bookId` - Book analytics
- `GET /api/v2/analytics/books/:bookId/trends` - Income/expense trends
- `GET /api/v2/analytics/books/:bookId/categories` - Category breakdown
- `GET /api/v2/analytics/books/:bookId/dashboard` - Dashboard summary

### Admin
- `GET /api/v2/admin/overview` - System overview
- `GET /api/v2/admin/users` - User management
- `GET /api/v2/admin/books` - Book management
- `GET /api/v2/admin/config` - System configuration
- `GET /api/v2/admin/audit-logs` - Audit logs

### Webhooks
- `POST /api/v2/webhooks/github` - GitHub webhooks
- `POST /api/v2/webhooks/stripe` - Stripe webhooks
- `POST /api/v2/webhooks/custom/:event` - Custom webhooks

### Health & Monitoring
- `GET /api/v2/health` - Basic health check
- `GET /api/v2/health/detailed` - Detailed health check
- `GET /api/v2/health/ready` - Readiness probe
- `GET /api/v2/health/live` - Liveness probe
- `GET /api/v2/health/metrics` - System metrics

## 🔧 Configuration

### Prerequisites
- Node.js 18+
- Cloudflare account
- Wrangler CLI

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run linting
npm run lint

# Run tests
npm test
```

### Production Deployment
```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

### GitHub Actions CI/CD
```yaml
name: Deploy to Cloudflare Workers
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Deploy to Cloudflare Workers
        run: npm run deploy:production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## 🔒 Security Best Practices

### Authentication
- JWT tokens with short expiration
- Refresh tokens with longer expiration
- Secure password hashing (bcrypt)
- Session management with device tracking
- Rate limiting on authentication endpoints

### Authorization
- Role-based access control (RBAC)
- Resource-level permissions
- Book-level membership system
- API key authentication for integrations

### Data Protection
- Input validation with Zod schemas
- SQL injection prevention
- XSS protection
- CSRF protection
- Secure headers

### Monitoring
- Audit logging for all actions
- Security event tracking
- Rate limiting with IP tracking
- Webhook signature verification

## 📊 Performance Optimization

### Database
- Optimized queries with proper indexing
- Connection pooling
- Query result caching
- Batch operations for bulk data

### Caching
- Redis-like caching with Cloudflare KV
- Session caching
- API response caching
- Static asset caching

### API Design
- RESTful API design
- Pagination for large datasets
- Compression for responses
- Efficient data structures

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.js
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration

# Run API tests
npm run test:api
```

### Load Testing
```bash
# Install artillery
npm install -g artillery

# Run load test
artillery run load-test.yml
```

## 📈 Monitoring & Analytics

### Health Checks
- Basic health endpoint
- Detailed health checks
- Readiness probes
- Liveness probes

### Metrics
- Response times
- Error rates
- Database performance
- Cache hit rates

### Logging
- Structured JSON logging
- Request/response logging
- Error tracking
- Performance monitoring

## 🔄 API Versioning

### Version Strategy
- URL-based versioning (`/api/v2/`)
- Backward compatibility
- Deprecation notices
- Migration guides

### Version Lifecycle
- Current stable: v2.0
- Previous versions: v1.0 (deprecated)
- Beta versions: v3.0-beta

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request
5. Code review process
6. Merge to main

### Code Standards
- ESLint configuration
- Prettier formatting
- TypeScript strict mode
- Conventional commits

## 📚 Documentation

### API Documentation
- OpenAPI/Swagger specification
- Interactive API docs
- Code examples
- SDK documentation

### Developer Guides
- Getting started guide
- Authentication guide
- Integration examples
- Best practices

## 🆘 Support

### Getting Help
- Documentation: https://docs.casflo.id
- Community forum: https://community.casflo.id
- Bug reports: https://github.com/casfloapp/casflo-api/issues
- Email support: support@casflo.id

### Status Page
- System status: https://status.casflo.id
- Incident history
- Uptime metrics
- Maintenance schedules

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Cloudflare Workers platform
- Hono.js framework
- Open source community
- Our amazing users

---

**Built with ❤️ by the Casflo team**
