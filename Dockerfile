FROM python:3.11-slim

WORKDIR /app

# Install PostgreSQL client libraries for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only Django backend files (exclude React frontend)
COPY manage.py .
COPY backend/ backend/
COPY store/ store/

# Collect static files at build time
ENV DEBUG=false
RUN python manage.py collectstatic --no-input

EXPOSE 8000

# Run migrations, seed products, then start server
CMD sh -c "python manage.py migrate --no-input && python manage.py seed_products && gunicorn backend.wsgi:application --bind 0.0.0.0:${PORT:-8000} --timeout 120 --workers 2"
