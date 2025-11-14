from rest_framework import serializers
from .models import ParkingSpot, ParkingSpotPhoto, Availability, SpotAvailability, Reservation, Perfil, Conversation
from accounts.models import CustomUser
from decimal import Decimal
from django.contrib.auth import get_user_model

User = get_user_model()

class PerfilSerializer(serializers.ModelSerializer):
    class Meta:
        model = Perfil
        fields = ['nome_completo', 'foto']

class OwnerSerializer(serializers.ModelSerializer):
    perfil = PerfilSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'perfil']

class ParkingSpotSerializerForReservation(serializers.ModelSerializer):
    photos = serializers.SerializerMethodField()
    owner = OwnerSerializer(read_only=True)
    
    class Meta:
        model = ParkingSpot
        fields = [
            'id', 'title', 'address', 'description', 'price_hour', 
            'tipo_vaga', 'size', 'has_camera', 'owner', 'photos',
            'latitude', 'longitude',
        ]
        
    def get_photos(self, obj):
        # Retorna a URL completa da foto
        request = self.context.get('request')
        photos_urls = [request.build_absolute_uri(photo.image.url) for photo in obj.photos.all()]
        return photos_urls

class CustomUserSerializer(serializers.ModelSerializer):
    perfil = PerfilSerializer(read_only=True)

    class Meta:
        model = CustomUser
        fields = ['perfil']

class ReservationListSerializer(serializers.ModelSerializer):
    spot = ParkingSpotSerializerForReservation(read_only=True)
    conversation_id = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = ['id', 'spot', 'renter', 'start_time', 'end_time', 'total_price', 'status', 'created_at', 'slot_number', 'conversation_id']
        read_only_fields = ['renter', 'total_price']
    
    def get_conversation_id(self, obj):
        try:
            return obj.conversation.id
        except Conversation.DoesNotExist:
            return None

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
    tipo_vaga = serializers.CharField(source='spot.tipo_vaga', read_only=True)
    address = serializers.CharField(source='spot.address', read_only=True)

    class Meta:
        model = Reservation
        fields = ['id', 'spot', 'renter', 'start_time', 'end_time', 'total_price', 'slot_number', 'tipo_vaga', 'address']
        read_only_fields = ['renter', 'total_price', 'tipo_vaga', 'address']
    
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
    photos = serializers.SerializerMethodField()
    availabilities_by_date = SpotAvailabilitySerializer(many=True, required=False) 
    owner = OwnerSerializer(read_only=True)

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
    
    def get_photos(self, obj):
        request = self.context.get('request')
        if request is None:
            # Caso o serializer seja usado em um contexto sem request (pouco comum)
            return [photo.image.url for photo in obj.photos.all()]

        # Retorna um array de URLs completas
        return [request.build_absolute_uri(photo.image.url) for photo in obj.photos.all()]
