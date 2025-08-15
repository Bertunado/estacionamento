from rest_framework import serializers
from .models import ParkingSpot, ParkingSpotPhoto, Availability, SpotAvailability, Reservation, Perfil
from accounts.models import CustomUser
from decimal import Decimal


class PerfilSerializer(serializers.ModelSerializer):
    class Meta:
        model = Perfil
        fields = ['nome_completo', 'foto']

class CustomUserSerializer(serializers.ModelSerializer):
    perfil = PerfilSerializer(read_only=True)

    class Meta:
        model = CustomUser
        fields = ['perfil']

class SpotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingSpot
        fields = '__all__'

class ReservationListSerializer(serializers.ModelSerializer):
    # ✅ Serializer aninhado para mostrar os detalhes do spot
    spot = SpotSerializer(read_only=True)

    class Meta:
        model = Reservation
        fields = ['id', 'spot', 'renter', 'start_time', 'end_time', 'total_price']
        read_only_fields = ['renter', 'total_price']

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
    spot = serializers.PrimaryKeyRelatedField(queryset=ParkingSpot.objects.all())
    renter = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Reservation
        fields = ['id', 'spot', 'renter', 'start_time', 'end_time', 'total_price', 'slot_number',]
        read_only_fields = ['renter', 'total_price']
    
    def create(self, validated_data):
        spot = validated_data['spot']
        start_time = validated_data['start_time']
        end_time = validated_data['end_time']

        if end_time <= start_time:
            raise serializers.ValidationError("O horário de término deve ser posterior ao horário de início.")

        duration = end_time - start_time
        hours = duration.total_seconds() / 3600
        total_price = Decimal(str(hours)) * spot.price_hour  
        validated_data['total_price'] = total_price

        return super().create(validated_data)



class ParkingSpotSerializer(serializers.ModelSerializer):
    photos = ParkingSpotPhotoSerializer(many=True, read_only=True)
    availabilities_by_date = SpotAvailabilitySerializer(many=True, required=False) 
    owner = CustomUserSerializer(read_only=True)

    class Meta:
        model = ParkingSpot
        fields = [
            'id', 'title', 'address', 'description', 'latitude', 'longitude',
            'price_hour', 'price_day', 'tipo_vaga', 'has_camera', 'size',
            'created_at', 'status', 'photos', 'quantity', 'availabilities_by_date',
            'owner',
        ]
        read_only_fields = ['id', 'created_at']
    
    def create(self, validated_data):
        availabilities_data = validated_data.pop('availabilities_by_date', [])
        parking_spot = ParkingSpot.objects.create(**validated_data)
        for availability_data in availabilities_data:
            quantity = availability_data.pop('available_quantity', 1)
            for slot_num in range(1, quantity + 1):
                SpotAvailability.objects.create(
                    spot=parking_spot,
                    slot_number=slot_num,
                    available_quantity=1,
                    **availability_data
                )
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
            instance.availabilities_by_date.all().delete()
            for availability_data in availabilities_data:
                quantity = availability_data.pop('available_quantity', 1)
                for slot_num in range(1, quantity + 1):
                    SpotAvailability.objects.create(
                    spot=instance,
                    slot_number=slot_num,
                    available_quantity=1,
                    **availability_data
                )
        return instance
