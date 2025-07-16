from rest_framework import serializers
from .models import ParkingSpot
from .models import ParkingSpotPhoto


class ParkingSpotPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingSpotPhoto
        fields = ['id', 'image']

class ParkingSpotSerializer(serializers.ModelSerializer):
    photos = ParkingSpotPhotoSerializer(many=True, read_only=True)

    class Meta:
        model  = ParkingSpot
        # tudo o que será gerado/exibido no frontend
        fields = [
            'id', 'title', 'description', 'address',
            'latitude', 'longitude',
            'price_hour', 'price_day',
            'tipo_vaga', 'size', 'has_camera',
            'owner', 'created_at', 'status',
            'photos',
        ]
        read_only_fields = ['id', 'owner', 'created_at']
