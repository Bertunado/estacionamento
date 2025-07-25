from rest_framework import serializers
from .models import ParkingSpot
from .models import ParkingSpotPhoto
from .models import Availability
from .models import SpotAvailability 
from .models import Reservation

class ParkingSpotPhotoSerializer(serializers.ModelSerializer):
    spot = serializers.PrimaryKeyRelatedField(queryset=ParkingSpot.objects.all()) 

    class Meta:
        model = ParkingSpotPhoto
        fields = ['id', 'spot', 'image', 'uploaded_at']
        read_only_fields = ['uploaded_at']
        
class AvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Availability
        fields = ['weekday', 'start', 'end']

class SpotAvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = SpotAvailability
        fields = ['id', 'available_date', 'start_time', 'end_time', 'available_quantity']
        read_only_fields = ['spot']
    
class ReservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reservation
        fields = ['id', 'spot', 'renter', 'start_time', 'end_time', 'total_price', 'status', 'created_at']
        read_only_fields = ['id', 'renter', 'total_price', 'status', 'created_at'] # Campos que o backend irá definir ou são automáticos

class ParkingSpotSerializer(serializers.ModelSerializer):
    photos = ParkingSpotPhotoSerializer(many=True, read_only=True)
    availabilities_by_date = SpotAvailabilitySerializer(many=True, required=False) 

    class Meta:
        model = ParkingSpot
        fields = [
            'id', 'title', 'address', 'description', 'latitude', 'longitude',
            'price_hour', 'price_day', 'tipo_vaga', 'has_camera', 'size',
            'created_at', 'status', 'photos', 'quantity', 'availabilities_by_date'
        ]
        read_only_fields = ['id', 'owner', 'created_at']

def create(self, validated_data):
        availabilities_data = validated_data.pop('availabilities_by_date', [])
        parking_spot = ParkingSpot.objects.create(**validated_data)
        for availability_data in availabilities_data:
            SpotAvailability.objects.create(spot=parking_spot, **availability_data)
        return parking_spot

def update(self, instance, validated_data):
        availabilities_data = validated_data.pop('availabilities_by_date', None)

        # Atualiza os campos do ParkingSpot
        instance.title = validated_data.get('title', instance.title)
        instance.address = validated_data.get('address', instance.address)
        instance.description = validated_data.get('description', instance.description)
        instance.latitude = validated_data.get('latitude', instance.latitude)
        instance.longitude = validated_data.get('longitude', instance.longitude)
        instance.price_hour = validated_data.get('price_hour', instance.price_hour)
        instance.price_day = validated_data.get('price_day', instance.price_day)
        instance.tipo_vaga = validated_data.get('tipo_vaga', instance.tipo_vaga)
        instance.has_camera = validated_data.get('has_camera', instance.has_camera)
        instance.size = validated_data.get('size', instance.size)
        instance.status = validated_data.get('status', instance.status)
        instance.quantity = validated_data.get('quantity', instance.quantity)
        instance.save()

        # Atualiza ou cria as disponibilidades
        if availabilities_data is not None:
            instance.availabilities_by_date.all().delete() # Deleta as antigas
            for availability_data in availabilities_data:
                SpotAvailability.objects.create(spot=instance, **availability_data)

        return instance