# Casiopea - AI Wardrobe Management System

An intelligent wardrobe management system that uses color theory (LAB color space + ΔE2000), weather data, and machine learning to generate perfect outfit suggestions.

## 🌟 Features

- **Smart Image Processing**: Background removal, color extraction in LAB space, perceptual hashing for deduplication
- **Color Theory AI**: Uses ΔE2000 for perceptually accurate color harmony (complementary, analogous, triadic)
- **Weather Integration**: Real-time weather with thermal band computation (heat index, wind chill)
- **Outfit Generation**: Constraint-based filtering + multi-factor scoring (color, formality, thermal fit, recency)
- **Wear Tracking**: Automatic recency filtering to avoid outfit repetition
- **Background Worker**: Scalable queue-based image processing with retry logic

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL with pgvector extension
- **Queue**: BullMQ + Redis
- **Storage**: S3/R2 (Cloudflare)
- **Weather**: Open-Meteo API (free, no key needed)
- **Image Processing**: Sharp, rembg (U²-Net), k-means clustering
- **ML**: CLIP (ONNX Runtime) for semantic image embeddings

### Key Components

```
Frontend (Next.js)
    ↓
API Routes (presign, jobs, outfits, weather)
    ↓
BullMQ Queue → Background Worker
    ↓
PostgreSQL + pgvector
```

## 📋 Prerequisites

- **Node.js** 18+ and npm/yarn
- **PostgreSQL** 14+ with **pgvector** extension
- **Redis** 6+
- **Python** 3.8+ (for rembg background removal)
- **S3-compatible storage** (AWS S3, Cloudflare R2, MinIO)

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up PostgreSQL with pgvector

```bash
# Install PostgreSQL 14+
# On macOS:
brew install postgresql@14

# Start PostgreSQL
brew services start postgresql@14

# Create database
createdb casiopea

# Install pgvector extension
psql casiopea -c "CREATE EXTENSION vector;"
```

### 3. Set Up Redis

```bash
# On macOS:
brew install redis
brew services start redis

# Verify Redis is running:
redis-cli ping  # Should return "PONG"
```

### 4. Install Python Dependencies (for rembg)

```bash
pip install rembg[gpu]  # or rembg[cpu] if no GPU

# Test rembg
echo "from rembg import remove" | python3
```

### 5. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/casiopea?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# S3/R2 Storage (example for Cloudflare R2)
S3_ENDPOINT="https://YOUR-ACCOUNT-ID.r2.cloudflarestorage.com"
S3_REGION="auto"
S3_ACCESS_KEY_ID="your-access-key"
S3_SECRET_ACCESS_KEY="your-secret-key"
S3_BUCKET_NAME="casiopea-wardrobe"
S3_PUBLIC_URL="https://your-public-domain.com"

# Weather API (Open-Meteo is free, no key needed)

# Sentry (optional)
SENTRY_DSN=""

# PostHog (optional)
POSTHOG_API_KEY=""

# App Config
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Worker Config
WORKER_CONCURRENCY="4"
CLIP_MODEL_PATH="./models/clip-vit-b32.onnx"
```

### 6. Set Up Database Schema

```bash
# Generate Prisma client
npm run prisma:generate

# Push schema to database
npm run prisma:push

# Or create migration
npm run prisma:migrate
```

### 7. Download CLIP Model (Optional, for similarity search)

```bash
# Create models directory
mkdir -p models

# Download CLIP ViT-B/32 ONNX model (~350MB)
# Option 1: Use a pre-converted model
wget https://github.com/xenova/transformers.js-examples/raw/main/clip-image-classification/onnx/model.onnx -O models/clip-vit-b32.onnx

# Option 2: Convert from PyTorch (requires transformers library)
# python scripts/convert_clip_to_onnx.py
```

### 8. Create Default User (for MVP)

```bash
psql casiopea -c "
INSERT INTO users (id, email, name, created_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'demo@casiopea.app', 'Demo User', NOW())
ON CONFLICT DO NOTHING;

INSERT INTO user_settings (user_id, location_lat, location_lon, location_name, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 40.7128, -74.0060, 'New York, NY', NOW(), NOW())
ON CONFLICT DO NOTHING;
"
```

### 9. Run the Application

```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Terminal 2: Start background worker
npm run worker
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📝 Usage

### Upload Clothing Items

1. Navigate to `/upload`
2. Drag & drop images or click to browse
3. Worker processes images in background:
   - Strips EXIF data
   - Removes background
   - Extracts color palette in LAB space
   - Detects category
   - Generates CLIP embedding
   - Checks for duplicates

### View Wardrobe

1. Navigate to `/wardrobe`
2. Filter by category
3. View color palettes and attributes
4. Click items to edit (category, warmth, formality)

### Generate Outfits

1. Homepage automatically generates outfits based on:
   - Current weather
   - Color harmony (ΔE2000)
   - Thermal fit
   - Recency (won't suggest recently worn items)
2. Click "Wear Today" to record outfit

## 🧪 API Endpoints

### Upload Flow

```bash
# 1. Get presigned upload URL
POST /api/upload/presign
Body: { filename, content_type, size_bytes }
Response: { upload_id, upload_url, fields }

# 2. Upload directly to S3 (client-side)
POST {upload_url}
FormData: fields + file

# 3. Notify backend
POST /api/upload/complete
Body: { upload_id, object_key, checksum_sha256 }
Response: { job_id, status, poll_url }

# 4. Poll job status
GET /api/jobs/{job_id}
Response: { status, result: { garment } }
```

### Weather

```bash
GET /api/weather?lat=40.7128&lon=-74.0060
Response: { current, derived: { thermal_band, is_rainy, is_windy } }
```

### Outfit Generation

```bash
POST /api/outfits/suggest
Body: { date, count, lat, lon }
Response: { weather, outfits: [{ score, score_breakdown, top, bottom, footwear }] }
```

### Garments

```bash
GET /api/garments?category=top
PATCH /api/garments/{id}
DELETE /api/garments/{id}
```

### Wear Tracking

```bash
POST /api/wear
Body: { garment_ids, date }
Response: { wear_history_id, next_available_dates }

GET /api/wear?user_id=...
Response: { history: [...] }
```

## 🎨 Color Theory Details

### Why LAB + ΔE2000?

- **RGB/HSL Problem**: Euclidean distance doesn't match human perception
- **CIELAB Solution**: Perceptually uniform color space
- **ΔE2000**: Accounts for lightness, chroma, and hue weighting

### Color Harmony Rules

```typescript
- Complementary: hue difference 120-240° (opposite on color wheel)
- Analogous: hue difference <30° (adjacent colors)
- Triadic: hue difference ~120° (evenly spaced)
- Neutral boost: low chroma (<15) pairs with anything
- Max ΔE: reject pairs >50 (too jarring)
```

### Default Scoring Weights

```typescript
{
  color: 0.30,      // Color harmony score
  style: 0.15,      // Formality match (low variance)
  weather: 0.20,    // Thermal fit to weather
  pattern: 0.10,    // Pattern mixing rules
  prefs: 0.10,      // User preferences (learned)
  recency: 0.10,    // Days since last worn
  diversity: 0.05   // Outfit uniqueness
}
```

## 🌡️ Weather Integration

### Thermal Band Computation

```typescript
Effective Temp = temperature + heat_index (>20°C) - wind_chill (<10°C)

Thermal Bands:
  <0°C:   CLO 2.5, warmth 5/5 (heavy winter)
  0-5°C:  CLO 2.0, warmth 4-5/5 (jacket + layers)
  5-10°C: CLO 1.5, warmth 3-4/5 (jacket or sweater)
  10-15°C: CLO 1.0, warmth 2-3/5 (light jacket)
  15-20°C: CLO 0.7, warmth 2-3/5 (long sleeves)
  20-25°C: CLO 0.5, warmth 1-2/5 (t-shirt)
  25-30°C: CLO 0.35, warmth 1/5 (light, breathable)
  >30°C:  CLO 0.25, warmth 1/5 (minimal)
```

### Weather Gates

```typescript
- Rain (POP >50%): require water_resistant outerwear
- Wind (>25 km/h): prefer wind_resistant outerwear
- UV High (>6): prefer uv_protective items (long sleeves, hats)
```

## 🔧 Configuration

### Worker Concurrency

Adjust in `.env`:
```env
WORKER_CONCURRENCY="4"  # 4 parallel image processing jobs
```

### Recency Days

Adjust per user in `user_settings.recency_days` (default: 7 days)

### Scoring Weights

Customize per user in `user_settings.outfit_weights` (JSON)

## 📊 Monitoring

### Logs

Structured JSON logs with `pino`:
```bash
# View worker logs
npm run worker | pino-pretty
```

### Sentry (Error Tracking)

Set `SENTRY_DSN` in `.env` to enable

### PostHog (Analytics)

Set `POSTHOG_API_KEY` in `.env` to track:
- Garment uploads
- Outfit generations
- User preferences

## 🐛 Troubleshooting

### Background removal fails

```bash
# Check rembg is installed
python3 -c "from rembg import remove; print('OK')"

# If fails, install:
pip install rembg[cpu]
```

### pgvector not found

```bash
psql casiopea -c "CREATE EXTENSION vector;"

# Or add to migration:
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;
```

### Redis connection refused

```bash
brew services start redis
redis-cli ping  # Should return PONG
```

### CLIP model not found

The system works without CLIP (skips embedding generation). To enable:
```bash
mkdir -p models
wget https://github.com/xenova/transformers.js-examples/raw/main/clip-image-classification/onnx/model.onnx -O models/clip-vit-b32.onnx
```

## 🚢 Deployment

### Next.js (Vercel)

```bash
vercel deploy
```

### Worker (Fly.io/Railway)

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run prisma:generate
CMD ["npm", "run", "worker"]
```

Deploy:
```bash
fly deploy
# or
railway up
```

### Database (Supabase/Neon)

Both support pgvector extension. Update `DATABASE_URL` accordingly.

## 📚 Project Structure

```
/casiopea
├── /src
│   ├── /app              # Next.js pages
│   │   ├── /api          # API routes
│   │   ├── page.tsx      # Dashboard
│   │   ├── /upload       # Upload UI
│   │   └── /wardrobe     # Wardrobe grid
│   ├── /lib              # Core libraries
│   │   ├── /color        # Color theory (LAB, ΔE2000)
│   │   ├── /weather      # Weather API client
│   │   ├── /outfit       # Outfit generation
│   │   ├── db.ts         # Prisma client
│   │   ├── queue.ts      # BullMQ setup
│   │   └── s3.ts         # S3 client
│   └── /worker           # Background worker
│       ├── index.ts      # Worker entry
│       └── /processors   # Job processors
├── /prisma
│   └── schema.prisma     # Database schema
└── package.json
```

## 🤝 Contributing

Pull requests welcome! Please:
1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation
4. Run linter: `npm run lint`

## 📄 License

MIT

## 🙏 Acknowledgments

- [U²-Net](https://github.com/xuebinqin/U-2-Net) for background removal
- [Open-Meteo](https://open-meteo.com/) for free weather API
- [CLIP](https://github.com/openai/CLIP) for image embeddings
- Color science research from CIE (Commission Internationale de l'Éclairage)

---

**Built with ❤️ using Next.js, PostgreSQL, and Color Theory**

