# MoFresh Backend API

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/Solvit-Africa-Training-Center/mofresh-backend/tree/main.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/Solvit-Africa-Training-Center/mofresh-backend/tree/main)
[![Coverage Status](https://coveralls.io/repos/github/Solvit-Africa-Training-Center/mofresh-backend/badge.svg?branch=main)](https://coveralls.io/github/Solvit-Africa-Training-Center/mofresh-backend?branch=main)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Solvit-Africa-Training-Center_mofresh-backend&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Solvit-Africa-Training-Center_mofresh-backend)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=Solvit-Africa-Training-Center_mofresh-backend&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=Solvit-Africa-Training-Center_mofresh-backend)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Solvit-Africa-Training-Center_mofresh-backend&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Solvit-Africa-Training-Center_mofresh-backend)


Backend API for MoFresh, a cold chain management system for Rwanda's agricultural sector.

## Overview

MoFresh Backend is a NestJS-based REST API that manages cold chain operations across three physical sites in Rwanda (Kigali, Musanze, and Rubavu). The system handles product inventory, cold room capacity tracking, order processing, automated invoicing, and payment integration with MTN Mobile Money (MoMo) Sandbox.

## Technology Stack

- **Framework**: NestJS 11.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL 15+
- **ORM**: Prisma 6.x
- **Authentication**: JWT with bcrypt
- **Payment Integration**: MTN Mobile Money (MoMo) Sandbox
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest with Supertest

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- PostgreSQL 15.x or higher
- Docker and Docker Compose (optional, for containerized development)

## Quick Start

### Automated Setup

Run the automated setup script to configure the entire development environment:

```bash
./setup.sh
```

The script will:
1. Create environment configuration from template
2. Install all dependencies
3. Start PostgreSQL via Docker
4. Generate Prisma Client
5. Run database migrations
6. Seed database with sample data
7. Build the application

### Manual Setup

If you prefer manual setup or need to troubleshoot:

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Set up database:
```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

4. Start development server:
```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

## Docker Setup

### Development Environment

Start PostgreSQL and the API in containers:

```bash
docker-compose up -d
```

Run migrations inside the container:

```bash
docker-compose exec api npm run prisma:migrate
```

Seed the database:

```bash
docker-compose exec api npm run prisma:seed
```

### Production Environment

Use the production Docker Compose configuration:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Environment Configuration

Copy `.env.example` to `.env` and configure the following variables:

### Required Variables

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/mofresh_db"

# Authentication
JWT_SECRET="your-secret-key-minimum-32-characters"
JWT_REFRESH_SECRET="your-refresh-secret-key-minimum-32-characters"
```

### Optional Variables

```bash
# Application
NODE_ENV="development"
PORT="3000"
API_PREFIX="api/v1"

# Security
BCRYPT_ROUNDS="10"
CORS_ORIGIN="http://localhost:3001"

# Rate Limiting
THROTTLE_TTL="60"
THROTTLE_LIMIT="100"

# Payment Integration (MTN Mobile Money Sandbox)
MOMO_API_USER="your-api-user"
MOMO_API_KEY="your-api-key"
MOMO_PRIMARY_KEY="your-primary-key"
MOMO_API_URL="https://sandbox.momodeveloper.mtn.com"
MOMO_CALLBACK_URL="your-callback-url"
MOMO_ENVIRONMENT="sandbox"
```

## Available Scripts

### Development

- `npm run start:dev` - Start development server with hot reload
- `npm run start:debug` - Start development server with debug mode
- `npm run prisma:studio` - Open Prisma Studio database GUI

### Testing

- `npm run test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Run tests with coverage report
- `npm run test:e2e` - Run end-to-end tests

### Code Quality

- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Database

- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Create and run new migration
- `npm run prisma:migrate:deploy` - Apply migrations (production)
- `npm run prisma:seed` - Seed database with sample data

### Production

- `npm run build` - Build for production
- `npm run start:prod` - Start production server

## Project Structure

```
mofresh-backend/
├── .circleci/              # CircleCI CI/CD configuration
├── prisma/                 # Database schema and migrations
│   ├── schema.prisma      # Prisma schema definition
│   └── seed.ts            # Database seeding script
├── src/
│   ├── common/            # Shared utilities
│   │   ├── decorators/   # Custom decorators
│   │   ├── filters/      # Exception filters
│   │   ├── guards/       # Authentication and authorization guards
│   │   ├── interceptors/ # Request/response interceptors
│   │   └── utils/        # Helper utilities
│   ├── config/           # Configuration module
│   ├── database/         # Database service
│   └── modules/          # Feature modules
│       ├── auth/         # Authentication
│       ├── users/        # User management
│       ├── sites/        # Site management
│       ├── cold-rooms/   # Cold room tracking
│       ├── cold-assets/  # Cold boxes, plates, tricycles
│       ├── products/     # Product inventory
│       ├── stock-movements/ # Stock tracking
│       ├── orders/       # Order processing
│       ├── invoices/     # Invoice generation
│       ├── payments/     # Payment processing
│       ├── rentals/      # Asset rental management
│       ├── reports/      # Business reports
│       ├── audit-logs/   # Audit trail
│       └── webhooks/     # External webhooks
├── test/                  # End-to-end tests
├── docker-compose.yml     # Development Docker setup
├── docker-compose.prod.yml # Production Docker setup
└── Dockerfile             # Container image definition
```

## API Documentation

Once the application is running, access the interactive API documentation:

**Swagger UI**: `http://localhost:3000/api/docs`

The documentation is auto-generated from code annotations and provides:
- Complete API endpoint listing
- Request/response schemas
- Authentication requirements
- Example requests

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. To access protected endpoints:

1. Obtain access token via login endpoint
2. Include token in Authorization header: `Bearer <token>`
3. Refresh tokens are used for extended sessions

### Default Credentials (Development Only)

After running the seed script, the following test accounts are available:

**Super Admin**
- Email: `admin@mofresh.rw`
- Password: `Password123!`

**Site Manager (Kigali)**
- Email: `manager1@mofresh.rw`
- Password: `Password123!`

**Site Manager (Musanze)**
- Email: `manager2@mofresh.rw`
- Password: `Password123!`

**Supplier**
- Email: `supplier1@mofresh.rw`
- Password: `Password123!`

**Client**
- Email: `client1@example.rw`
- Password: `Password123!`

**Important**: Change these credentials before deploying to production.

## Database Schema

The database uses PostgreSQL with Prisma ORM. Key entities include:

- **Users**: System users with role-based access control
- **Sites**: Three physical locations (Kigali, Musanze, Rubavu)
- **Cold Rooms**: Temperature-controlled storage facilities
- **Products**: Inventory items with stock tracking
- **Orders**: Customer orders with approval workflow
- **Invoices**: Auto-generated billing documents
- **Payments**: Payment processing via MTN Mobile Money (MoMo)
- **Rentals**: Cold box, cold plate, and tricycle rentals
- **Audit Logs**: Complete activity tracking

### Roles and Permissions

The system implements role-based access control with four user roles:

- **SUPER_ADMIN**: Full system access across all sites
- **SITE_MANAGER**: Manages operations for assigned site
- **SUPPLIER**: Provides products to the system
- **CLIENT**: Places orders and requests rentals

## Testing

The project uses Jest for testing with the following structure:

- **Unit Tests**: Test individual services and utilities
- **Integration Tests**: Test module interactions
- **End-to-End Tests**: Test complete API workflows

Run tests with coverage:

```bash
npm run test:cov
```

Coverage reports are generated in the `coverage/` directory.

Target: Minimum 80% code coverage

## Continuous Integration

The project uses CircleCI for continuous integration. The pipeline includes:

1. **Dependencies**: Install and cache npm packages
2. **Lint**: Code quality checks with ESLint
3. **Test**: Unit and E2E tests with PostgreSQL
4. **SonarQube**: Static code analysis
5. **Coveralls**: Coverage tracking
6. **Build**: Production bundle creation

## Code Quality

### Linting

ESLint is configured with TypeScript rules. Run linting:

```bash
npm run lint
```

### Formatting

Prettier handles code formatting. Format code:

```bash
npm run format
```

### Static Analysis

SonarQube analyzes code quality. Configuration is in `sonar-project.properties`.

### Coverage

Coveralls tracks test coverage trends. Configuration is in `.coveralls.yml`.

## Security

The application implements multiple security layers:

- **Authentication**: JWT tokens with bcrypt password hashing
- **Authorization**: Role-based access control with guards
- **Input Validation**: Class-validator for request validation
- **Rate Limiting**: Throttler to prevent abuse
- **Security Headers**: Helmet.js for HTTP security
- **CORS**: Configurable cross-origin resource sharing
- **SQL Injection Prevention**: Prisma parameterized queries

### Security Best Practices

1. Never commit `.env` file with real credentials
2. Use strong JWT secrets (minimum 32 characters)
3. Rotate secrets regularly in production
4. Enable HTTPS/TLS in production
5. Configure rate limiting based on your needs
6. Review audit logs regularly

## Multi-Site Architecture

The system supports three physical sites with data isolation:

- Site Managers can only access their assigned site data
- Super Admins can access data across all sites
- Suppliers and Clients are scoped to their site
- Site context is enforced via guards

## Deployment

### Production Checklist

Before deploying to production:

- [ ] Configure production database
- [ ] Set strong JWT secrets
- [ ] Configure MTN MoMo production credentials
- [ ] Enable HTTPS/TLS
- [ ] Set up database backups
- [ ] Configure proper CORS origins
- [ ] Set up monitoring and logging
- [ ] Run database migrations
- [ ] Review security settings

### Database Migrations

In production, use the deploy command:

```bash
npm run prisma:migrate:deploy
```

This applies pending migrations without prompting for confirmation.

## Troubleshooting

### Port Already in Use

If port 3000 is occupied:

```bash
lsof -i :3000
kill -9 <PID>
```

Or change the PORT in `.env`

### Database Connection Error

Verify PostgreSQL is running:

```bash
docker-compose up -d db
```

Check DATABASE_URL in `.env` is correct.

### Prisma Client Out of Sync

Regenerate Prisma Client:

```bash
npm run prisma:generate
```

### Migration Conflicts

Reset database (development only):

```bash
npm run prisma:migrate:reset
```

Warning: This deletes all data.

## Performance Considerations

- Database connection pooling is enabled by default via Prisma
- Response compression is enabled via middleware
- Pagination should be implemented for list endpoints
- Consider Redis caching for frequently accessed reports
- Monitor database query performance with EXPLAIN ANALYZE

## Contributing

### Development Workflow

1. Create a feature branch from `main`
2. Implement changes with tests
3. Run linter and tests locally
4. Commit with clear, descriptive messages
5. Push and create pull request
6. Wait for CI pipeline to pass
7. Request code review
8. Merge after approval

### Code Review Checklist

- [ ] Code follows project conventions
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No security vulnerabilities introduced
- [ ] Database migrations are included if needed
- [ ] Environment variables are documented

## Support

For issues, questions, or contributions:

- Review existing documentation first
- Check troubleshooting section
- Search closed issues for similar problems
- Open a new issue with detailed information

## License

MIT License

Copyright (c) 2026 MoFresh

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

**Version**: 1.0.0  
**Last Updated**: January 26, 2026  
**Status**: Foundation Complete - Ready for Feature Development
