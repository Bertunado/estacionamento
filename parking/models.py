from django.db import models
from django.conf import settings
from accounts.models import CustomUser


# Vaga de estacionamento
class ParkingSpot(models.Model):
    TIPOS_DE_VAGA = [
        ('rua_coberta', 'Rua (Coberta)'),
        ('rua_descoberta', 'Rua (Descoberta)'),
        ('garagem', 'Garagem'),
        ('predio_coberta', 'Prédio (Coberta)'),
        ('predio_descoberta', 'Prédio (Descoberta)'),
    ]

    owner = models.ForeignKey('accounts.CustomUser', on_delete=models.CASCADE)
    title = models.CharField(max_length=120)
    description = models.TextField()
    address = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    price_hour = models.DecimalField(max_digits=6, decimal_places=2)
    price_day = models.DecimalField(max_digits=6, decimal_places=2)
    tipo_vaga = models.CharField(max_length=20, choices=TIPOS_DE_VAGA)
    has_camera = models.BooleanField(default=False)
    size = models.CharField(max_length=30, default="Médio")
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default="Ativa")
    quantity = models.IntegerField(default=1, help_text="Número total de vagas neste local.")

    def __str__(self):
        return f"{self.title} – {self.address}"
        
class SpotAvailability(models.Model):
    spot = models.ForeignKey(ParkingSpot, on_delete=models.CASCADE, related_name='availabilities_by_date')
    slot_number = models.IntegerField(default=1, help_text="Número específico da vaga.")
    available_date = models.DateField() 
    start_time = models.TimeField()
    end_time = models.TimeField()
    available_quantity = models.IntegerField(default=1, help_text="Número de vagas disponíveis neste período da data.")

    class Meta:
        # Garante que não haja slots de disponibilidade duplicados para o mesmo spot na mesma data/período
        unique_together = ('spot', 'slot_number', 'available_date', 'start_time', 'end_time')
        ordering = ['available_date', 'start_time']

    def __str__(self):
        return f"{self.spot.title} - {self.available_date} ({self.start_time}-{self.end_time}) - Vagas: {self.available_quantity}"
    
class ParkingSpotPhoto(models.Model):
    spot = models.ForeignKey(ParkingSpot, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="parking_spot_photos/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

class Perfil(models.Model):
    usuario = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    nome_completo = models.CharField(max_length=100)
    foto = models.ImageField(
    upload_to='fotos_perfil/',
    blank=True,
    null=True,
    default='fotos_perfil/anonimo.jpg'  # Caminho relativo dentro de MEDIA_ROOT
)
    telefone = models.CharField(max_length=20)
    modelo_veiculo = models.CharField(max_length=100)
    marca_veiculo = models.CharField(max_length=100)
    cor_veiculo = models.CharField(max_length=30)
    placa_veiculo = models.CharField(max_length=10)

    def __str__(self):
        return self.nome_completo
    
# Disponibilidade (dias e horários em que a vaga pode ser reservada)
class Availability(models.Model):
    parking_spot = models.ForeignKey(ParkingSpot, on_delete=models.CASCADE, related_name='legacy_availabilities')
    spot     = models.ForeignKey(ParkingSpot, on_delete=models.CASCADE, related_name="availabilities")
    weekday  = models.IntegerField(choices=[(i, i) for i in range(7)])  # 0 = segunda‑feira
    start    = models.TimeField()
    end      = models.TimeField()

    class Meta:
        ordering = ["weekday", "start"]


# Reserva
class Reservation(models.Model):

    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('confirmed', 'Confirmada'),
        ('refused', 'Recusada'),
        ('cancelled', 'Cancelada'),
    ]

    spot        = models.ForeignKey(ParkingSpot, on_delete=models.CASCADE, related_name="reservations")
    renter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    start_time  = models.DateTimeField()
    end_time    = models.DateTimeField()
    total_price = models.DecimalField(max_digits=8, decimal_places=2, default=0.00) 
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at  = models.DateTimeField(auto_now_add=True)
    slot_number = models.PositiveIntegerField()

    # cria automaticamente uma conversa assim que a reserva é inserida
    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            Conversation.objects.create(
                reservation=self,
                seller=self.spot.owner,
                buyer=self.renter
            )

    def __str__(self):
        return f"Reserva de {self.renter.username} para {self.spot.title} de {self.start_time.strftime('%d/%m %H:%M')} a {self.end_time.strftime('%d/%m %H:%M')}"

# Chat
class Conversation(models.Model):
    reservation      = models.OneToOneField(Reservation, on_delete=models.CASCADE)
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations_seller")
    buyer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations_buyer")
    started_at       = models.DateTimeField(auto_now_add=True)
    last_message_at  = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Chat #{self.pk} – reserva {self.reservation_id}"

class Message(models.Model):
    conversation = models.ForeignKey(Conversation, related_name="messages", on_delete=models.CASCADE)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    text         = models.TextField(max_length=2000)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Msg de {self.sender} em {self.created_at:%d/%m %H:%M}"