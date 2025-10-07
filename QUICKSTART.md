# 🚀 Quick Start Guide

## TL;DR - Get Running in 5 Minutes

```bash
# 1. Run automated setup (requires Docker)
./scripts/init-dev.sh

# 2. Start the app (in two terminals)
npm run dev      # Terminal 1
npm run worker   # Terminal 2

# 3. Open browser
open http://localhost:3000
```

That's it! Upload some clothing photos and start generating outfits.

---

## What Gets Set Up

The `init-dev.sh` script automatically:

1. ✅ Starts PostgreSQL with pgvector (Docker)
2. ✅ Starts Redis (Docker)
3. ✅ Starts MinIO (S3-compatible storage) (Docker)
4. ✅ Creates database schema
5. ✅ Creates default user
6. ✅ Configures environment variables

---

## Manual Setup (If Script Fails)

### 1. Start Services

```bash
# PostgreSQL with pgvector
docker run --name casiopea-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=casiopea \
  -p 5433:5432 \
  -d ankane/pgvector

# Redis
docker run --name casiopea-redis \
  -p 6379:6379 \
  -d redis:alpine

# MinIO (S3 storage)
docker volume create casiopea-minio-data
docker run --name casiopea-minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -v casiopea-minio-data:/data \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -e MINIO_DOMAIN=localhost \
  -d minio/minio server /data --console-address ":9001"
```

### 2. Configure MinIO

```bash
docker exec casiopea-minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec casiopea-minio mc mb local/casiopea
docker exec casiopea-minio mc anonymous set upload local/casiopea
```

### 3. Create .env

```bash
cp .env.example .env
# Edit .env with your local settings
```

### 4. Setup Database

```bash
npm install
npm run prisma:generate
npm run prisma:push
```

### 5. Create Default User

```bash
docker exec -i casiopea-postgres psql -U postgres -d casiopea << 'SQL'
INSERT INTO users (id, email, name, created_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'demo@casiopea.app', 'Demo User', NOW());

INSERT INTO user_settings (id, user_id, location_lat, location_lon, location_name, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 40.7128, -74.0060, 'New York, NY', NOW(), NOW());
SQL
```

### 6. Run

```bash
npm run dev      # Terminal 1
npm run worker   # Terminal 2
```

---

## Verify Setup

### Check Services

```bash
# PostgreSQL
docker exec casiopea-postgres pg_isready
# Expected: /var/run/postgresql:5432 - accepting connections

# Redis
docker exec casiopea-redis redis-cli ping
# Expected: PONG

# MinIO
curl http://localhost:9000/minio/health/live
# Expected: 200 OK
```

### Test API

```bash
# Weather API (should return weather data)
curl "http://localhost:3000/api/weather?lat=40.7128&lon=-74.0060"

# Garments API (should return empty array initially)
curl "http://localhost:3000/api/garments"
```

---

## First Steps After Setup

### 1. Upload Your First Item

1. Go to http://localhost:3000/upload
2. Drag & drop a photo of a shirt
3. Wait ~15 seconds for processing
4. See extracted colors and auto-detected category

### 2. View Wardrobe

1. Go to http://localhost:3000/wardrobe
2. See your uploaded item
3. Filter by category

### 3. Generate Outfits

1. Go to http://localhost:3000
2. Allow location access (for weather)
3. Click "Generate" to see outfit suggestions
4. View color harmony scores

---

## Common Issues

### "Connection refused" Errors

```bash
# Check if services are running
docker ps

# Start services if stopped
docker start casiopea-postgres casiopea-redis casiopea-minio
```

### "pgvector extension not found"

```bash
docker exec -i casiopea-postgres psql -U postgres -d casiopea -c "CREATE EXTENSION vector;"
```

### "Worker not processing jobs"

```bash
# Check Redis connection
docker exec casiopea-redis redis-cli ping

# Restart worker
# Ctrl+C in worker terminal, then:
npm run worker
```

### "Background removal failed"

Background removal is optional. The system works without it (garments keep their original backgrounds).

To enable rembg:
```bash
pip install rembg
```

---

## Admin Panels

- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)
- **Prisma Studio**: `npm run prisma:studio` → http://localhost:5555

---

## Stop Services

```bash
docker stop casiopea-postgres casiopea-redis casiopea-minio
```

## Remove Everything

```bash
docker rm -f casiopea-postgres casiopea-redis casiopea-minio
rm -rf node_modules .env
```

---

## Next Steps

- Read `README.md` for architecture details
- Read `IMPLEMENTATION_SUMMARY.md` for what's built
- Check `SETUP.md` for production deployment

---

**Questions?** Check the troubleshooting section in README.md

