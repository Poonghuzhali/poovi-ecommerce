from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, health_check

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')

urlpatterns = [
    path('health/', health_check, name='health-check'),
    path('', include(router.urls)),
]
