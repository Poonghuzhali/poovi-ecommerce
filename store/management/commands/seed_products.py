import os
from django.core.management.base import BaseCommand
from store.models import Product

SAMPLE_PRODUCTS = [
    {
        "name": "Smart Home Hub Pro",
        "description": "Voice-controlled smart hub with Wi-Fi, Bluetooth, and Zigbee support for seamless home automation.",
        "price": 4999.00,
        "image": "images/smart-home-hub.jpg",
        "category": "electronics",
        "tags": ["smart", "home", "automation"],
    },
    {
        "name": "Wireless Noise-Cancel Earbuds",
        "description": "Premium true wireless earbuds with active noise cancellation and 30-hour battery life.",
        "price": 3499.00,
        "image": "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=400&fit=crop",
        "category": "electronics",
        "tags": ["audio", "wireless", "premium"],
    },
    {
        "name": "Organic Cotton T-Shirt",
        "description": "Soft, breathable 100% organic cotton tee available in multiple colors. Perfect for everyday wear.",
        "price": 899.00,
        "image": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop",
        "category": "fashion",
        "tags": ["organic", "casual", "cotton"],
    },
    {
        "name": "Genuine Leather Wallet",
        "description": "Handcrafted full-grain leather wallet with RFID blocking and multiple card slots.",
        "price": 1299.00,
        "image": "https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&h=400&fit=crop",
        "category": "fashion",
        "tags": ["leather", "accessories", "premium"],
    },
    {
        "name": "Premium Yoga Mat",
        "description": "Eco-friendly non-slip yoga mat with extra cushioning. Includes carrying strap.",
        "price": 1599.00,
        "image": "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400&h=400&fit=crop",
        "category": "fitness",
        "tags": ["yoga", "eco", "fitness"],
    },
    {
        "name": "Stainless Protein Shaker",
        "description": "BPA-free shaker bottle with mixing ball and leak-proof lid. 750ml capacity.",
        "price": 599.00,
        "image": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&h=400&fit=crop",
        "category": "fitness",
        "tags": ["gym", "nutrition", "bottle"],
    },
    {
        "name": "Handcrafted Ceramic Vase",
        "description": "Elegant minimalist ceramic vase perfect for fresh flowers or standalone decor.",
        "price": 2199.00,
        "image": "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=400&h=400&fit=crop",
        "category": "home",
        "tags": ["decor", "ceramic", "handmade"],
    },
    {
        "name": "LED Desk Lamp",
        "description": "Adjustable LED desk lamp with touch controls, USB charging port, and eye-care mode.",
        "price": 1899.00,
        "image": "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&h=400&fit=crop",
        "category": "home",
        "tags": ["lighting", "office", "smart"],
    },
    {
        "name": "Luxury Skincare Gift Set",
        "description": "Complete 5-piece skincare set with cleanser, toner, serum, moisturizer, and eye cream.",
        "price": 4299.00,
        "image": "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=400&fit=crop",
        "category": "beauty",
        "tags": ["skincare", "gift", "luxury"],
    },
    {
        "name": "Ultra-Light Running Shoes",
        "description": "Breathable mesh running shoes with responsive cushioning for marathon-level comfort.",
        "price": 5499.00,
        "image": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop",
        "category": "sports",
        "tags": ["running", "shoes", "performance"],
    },
]


class Command(BaseCommand):
    help = "Seed the database with 10 sample products"

    def handle(self, *args, **options):
        if Product.objects.exists():
            # Update broken image URLs for existing products
            updated = Product.objects.filter(name="Smart Home Hub Pro").update(
                image="images/smart-home-hub.jpg"
            )
            if updated:
                self.stdout.write(self.style.SUCCESS("Updated Smart Home Hub Pro image."))
            else:
                self.stdout.write(self.style.WARNING("Products already exist. Skipping seed."))
            return

        for product_data in SAMPLE_PRODUCTS:
            Product.objects.create(**product_data)

        self.stdout.write(self.style.SUCCESS(f"Successfully seeded {len(SAMPLE_PRODUCTS)} products."))
