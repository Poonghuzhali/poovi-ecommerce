#!/usr/bin/env bash
set -o errexit

echo "==> Installing Python dependencies..."
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo "==> Running database migrations..."
python manage.py migrate --no-input

echo "==> Seeding sample products..."
python manage.py seed_products

echo "==> Collecting static files..."
python manage.py collectstatic --no-input

echo "==> Build completed successfully."
