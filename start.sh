#!/usr/bin/env bash
set -o errexit

echo "==> Running migrations on startup..."
python manage.py migrate --no-input

echo "==> Starting Gunicorn..."
exec gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120
