#!/bin/bash

# Casiopea Development Environment Setup Script
# Run this to quickly set up a local development environment

set -e

echo "🚀 Setting up Casiopea development environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Start infrastructure with Docker
echo "📦 Starting PostgreSQL, Redis, and MinIO with Docker..."

# PostgreSQL with pgvector
docker run --name casiopea-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=casiopea \
  -p 5432:5432 \
  -d ankane/pgvector 2>/dev/null || docker start casiopea-postgres

# Redis
docker run --name casiopea-redis \
  -p 6379:6379 \
  -d redis:alpine 2>/dev/null || docker start casiopea-redis

# MinIO (S3-compatible storage)
docker run --name casiopea-minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -d minio/minio server /data --console-address ":9001" 2>/dev/null || docker start casiopea-minio

echo "⏳ Waiting for services to start..."
sleep 5

# Configure MinIO bucket
echo "🪣 Creating MinIO bucket..."
docker exec casiopea-minio mc alias set local http://localhost:9000 minioadmin minioadmin 2>/dev/null || true
docker exec casiopea-minio mc mb local/casiopea 2>/dev/null || echo "Bucket already exists"
docker exec casiopea-minio mc anonymous set download local/casiopea 2>/dev/null || true

# Create .env file
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
DATABASE_URL="postgresql://postgres:password@localhost:5432/casiopea?schema=public"
REDIS_URL="redis://localhost:6379"

S3_ENDPOINT="http://localhost:9000"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"
S3_BUCKET_NAME="casiopea"
S3_PUBLIC_URL="http://localhost:9000/casiopea"

NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
WORKER_CONCURRENCY="2"
CLIP_MODEL_PATH="./models/clip-vit-b32.onnx"
EOF
    echo "✅ .env file created"
else
    echo "⚠️  .env file already exists, skipping..."
fi

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Generate Prisma client and push schema
echo "🗄️  Setting up database..."
npm run prisma:generate
npm run prisma:push

# Create default user
echo "👤 Creating default user..."
docker exec -i casiopea-postgres psql -U postgres -d casiopea << 'SQL'
INSERT INTO users (id, email, name, created_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'demo@casiopea.app', 'Demo User', NOW())
ON CONFLICT DO NOTHING;

INSERT INTO user_settings (user_id, location_lat, location_lon, location_name, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 40.7128, -74.0060, 'New York, NY', NOW(), NOW())
ON CONFLICT DO NOTHING;
SQL

echo ""
echo "✨ Setup complete!"
echo ""
echo "🚀 To start the application:"
echo ""
echo "   Terminal 1: npm run dev      # Start Next.js (http://localhost:3000)"
echo "   Terminal 2: npm run worker   # Start background worker"
echo ""
echo "📊 Admin panels:"
echo "   MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
echo "   Prisma Studio: npm run prisma:studio"
echo ""
echo "🧹 To stop services:"
echo "   docker stop casiopea-postgres casiopea-redis casiopea-minio"
echo ""
echo "🗑️  To remove everything:"
echo "   docker rm -f casiopea-postgres casiopea-redis casiopea-minio"
echo ""

