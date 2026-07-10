# Poovi E-Commerce Web App

A full-stack e-commerce application built with **React (Vite)**, **Django REST API**, **PostgreSQL (Render)**, and **Firebase Firestore** for order storage.

Covers Day 69–71 curriculum: product catalog, shopping cart, checkout, Firebase orders, recommendations, smart search with debounce, and responsive UI.

---

## Project Structure

```
├── backend/              # Django project settings
├── store/                # Django app — Product model & REST API
├── ecommerce-app/        # React frontend (Vite + Tailwind)
├── render.yaml           # Render deployment blueprint
├── build.sh              # Render build script
└── requirements.txt      # Python dependencies
```

---

## Features

- **10 dynamic products** loaded from Django REST API (PostgreSQL on Render)
- Product cards with images, categories, and tags
- Shopping cart with quantity tracking
- Checkout form with email validation
- Orders saved to Firebase Firestore
- Category-based product recommendations
- Debounced smart search (name, description, category)
- Responsive Tailwind CSS grid layout
- Currency formatting (₹ Indian Rupees)
- Deployed frontend via GitHub Pages, backend via Render

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- Firebase project (free tier) for order storage

### 1. Backend Setup

```bash
# From project root
pip install -r requirements.txt

# Run migrations and seed 10 products
python manage.py migrate
python manage.py seed_products

# Start Django dev server
python manage.py runserver
```

API available at: `http://127.0.0.1:8000/api/products/`

### 2. Frontend Setup

```bash
cd ecommerce-app
cp .env.example .env
# Edit .env with your Firebase credentials

npm install
npm run dev
```

App runs at: `http://localhost:5173`

---

## Deployment

### Backend — Render (Database + API)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New Blueprint** → connect repo `Poonghuzhali/poovi-ecommerce`
3. Click **Apply** — Render creates PostgreSQL + API from `render.yaml`
4. Wait for build to finish (check **Logs** tab if it fails)
5. Copy your API URL: `https://poovi-ecommerce-api.onrender.com`
6. Test health check: `https://poovi-ecommerce-api.onrender.com/api/health/`
7. Test products: `https://poovi-ecommerce-api.onrender.com/api/products/`

**If a previous deploy failed:** open your Blueprint → click **Manual Sync** (or delete the failed instance and create a new Blueprint).

**Common Render fixes already applied:**
- `bash build.sh` instead of `./build.sh` (permission fix)
- `RENDER_EXTERNAL_HOSTNAME` + `.onrender.com` in `ALLOWED_HOSTS`
- PostgreSQL SSL config via `dj-database-url`
- Health check at `/api/health/`

### Frontend — GitHub Pages

1. In your GitHub repo → **Settings → Pages** → Source: **GitHub Actions**
2. Add repository **Secrets** (Settings → Secrets and variables → Actions):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
3. Add repository **Variable**:
   - `VITE_API_URL` = `https://your-render-api.onrender.com/api`
4. Push to `main` branch — GitHub Actions deploys automatically

### Firebase Setup (Orders)

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Firestore Database** (test mode for development)
3. Enable **Anonymous Authentication** (Authentication → Sign-in method)
4. Copy your web app config into GitHub Secrets and local `.env`

Firestore path for orders:
```
/artifacts/{appId}/users/{userId}/orders
```

---

## API Endpoints

| Method | Endpoint            | Description          |
|--------|---------------------|----------------------|
| GET    | `/api/products/`    | List all products    |
| GET    | `/api/products/{id}/` | Get single product |

---

## Tech Stack

| Layer     | Technology                    |
|-----------|-------------------------------|
| Frontend  | React, Vite, Tailwind CSS v4  |
| Backend   | Django 5, Django REST Framework |
| Database  | PostgreSQL (Render) / SQLite (local) |
| Orders    | Firebase Firestore            |
| Deploy    | GitHub Pages + Render         |

---

## License

Private & Confidential — Vetri Technology Solutions
