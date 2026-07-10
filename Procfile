web: python manage.py migrate --no-input && python manage.py seed_products && gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT --timeout 120
