from rest_framework import serializers
from .models import ParkingSpot

class ParkingSpotSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ParkingSpot
        # inclua tudo o que será gerado/exibido no frontend
        fields = [
            'id', 'title', 'description', 'address',
            'latitude', 'longitude',
            'price_hour', 'price_day',
            'covered', 'size', 'has_camera',
            'owner', 'created_at'
        ]
        read_only_fields = ['id', 'owner', 'created_at']