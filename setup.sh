#!/bin/bash

# MoFresh Backend Setup Script
# This script automates the initial project setup

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         MoFresh Backend - Automated Setup Script          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📋 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration before continuing!"
    echo "   Key variables to update:"
    echo "   - DB_PASSWORD"
    echo "   - JWT_SECRET (min 32 characters)"
    echo "   - JWT_REFRESH_SECRET"
    echo "   - MOMO_SANDBOX credentials"
    echo ""
    read -p "Press Enter after updating .env file..."
else
    echo "✅ .env file already exists"
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Check if Docker is running (for database)
if docker info > /dev/null 2>&1; then
    echo ""
    echo "🐳 Docker is running. Starting PostgreSQL..."
    docker-compose up -d db
    
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 5
else
    echo ""
    echo "⚠️  Docker not running. Make sure PostgreSQL is running manually."
    read -p "Press Enter when PostgreSQL is ready..."
fi

# Generate Prisma Client
echo ""
echo "🔧 Generating Prisma Client..."
npm run prisma:generate

# Run migrations
echo ""
echo "🗄️  Running database migrations..."
npm run prisma:migrate || {
    echo "❌ Migration failed. Check your database connection in .env"
    exit 1
}

# Seed database
echo ""
echo "🌱 Seeding database with sample data..."
npm run prisma:seed || {
    echo "⚠️  Seeding failed. You can run 'npm run prisma:seed' manually later."
}

# Build the project
echo ""
echo "🔨 Building project..."
npm run build

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete! 🎉                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Start development server:"
echo "   npm run start:dev"
echo ""
echo "2. Access API Documentation:"
echo "   http://localhost:3000/api/docs"
echo ""
echo "3. Login credentials (after seeding):"
echo "   Super Admin: admin@mofresh.rw / Password123!"
echo "   Site Manager: manager1@mofresh.rw / Password123!"
echo "   Client: client1@example.rw / Password123!"
echo ""
echo "4. Open Prisma Studio (database GUI):"
echo "   npm run prisma:studio"
echo ""
echo "5. Run tests:"
echo "   npm run test"
echo ""
echo "🚀 Happy coding!"
