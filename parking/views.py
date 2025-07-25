from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse, Http404
from django.shortcuts import render, get_object_or_404, redirect
from django.utils import timezone
from .serializers import ParkingSpotSerializer, ReservationSerializer, ParkingSpotPhotoSerializer, SpotAvailabilitySerializer
from rest_framework import generics, permissions, serializers, viewsets
from .forms import PerfilForm, RegistroUsuarioForm
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import get_user_model, login
from .models import Perfil, ParkingSpot, ParkingSpotPhoto, SpotAvailability, Availability, Reservation, Conversation,  Message
from django.views.decorators.csrf import csrf_exempt
from django import forms
import os
import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import RetrieveUpdateDestroyAPIView
from django.utils.dateparse import parse_time
import logging
from rest_framework.parsers import MultiPartParser, FormParser
from decimal import Decimal
from datetime import datetime

User = get_user_model()
logger = logging.getLogger(__name__)

dias_dict = {
    "Segunda-feira": 0,
    "Terça-feira": 1,
    "Quarta-feira": 2,
    "Quinta-feira": 3,
    "Sexta-feira": 4,
    "Sábado": 5,
    "Domingo": 6,
}

def diasSemanaParaInt(dia_nome):
    return dias_dict.get(dia_nome, 0)

@login_required
def home(request):
    perfil = Perfil.objects.filter(usuario=request.user).first()
    return render(request, 'parking/home.html', {
        'perfil': perfil
    })

class ParkingSpotPhotoViewSet(viewsets.ModelViewSet):
    queryset = ParkingSpotPhoto.objects.all() # Queryset padrão para listar todas as fotos
    serializer_class = ParkingSpotPhotoSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser] # ESSENCIAL para lidar com uploads de arquivos

    def get_queryset(self):
        # Este ViewSet lida com fotos, então o queryset deve ser de ParkingSpotPhoto.
        return ParkingSpotPhoto.objects.all()

    def perform_create(self, serializer):
        # 1. Obtenha o 'spot_id' que vem do frontend no FormData
        spot_id_from_request = self.request.data.get('spot')

        if not spot_id_from_request:
            raise serializers.ValidationError({"spot": "O ID do spot é obrigatório para o upload da foto."})

        try:
            # 2. Encontre a instância do ParkingSpot e verifique se pertence ao usuário logado
            spot_instance = ParkingSpot.objects.get(id=spot_id_from_request, owner=self.request.user)
            
            # 3. Salve a foto associando-a à instância do spot
            serializer.save(spot=spot_instance) # Passa a instância do Spot validada para o serializer

        except ParkingSpot.DoesNotExist:
            # Se o spot não existir ou não pertencer ao usuário
            raise serializers.ValidationError(
                {"detail": "Spot inválido ou você não tem permissão para adicionar fotos a este spot."}
            )
class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.all()
    serializer_class = ReservationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Um usuário só pode ver as reservas que ele fez (como renter)
        return Reservation.objects.filter(renter=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        # 1. Pega os dados do corpo da requisição
        spot_id = self.request.data.get('spot')
        start_time_str = self.request.data.get('start_time')
        end_time_str = self.request.data.get('end_time')

        # 2. Valida se os dados essenciais estão presentes
        if not all([spot_id, start_time_str, end_time_str]):
            raise serializers.ValidationError({"detail": "Dados de reserva incompletos (spot, start_time, end_time são obrigatórios)."})

        # 3. Encontra a instância da vaga (ParkingSpot)
        try:
            spot = ParkingSpot.objects.get(id=spot_id)
        except ParkingSpot.DoesNotExist:
            raise serializers.ValidationError({"spot": "Vaga de estacionamento não encontrada."})

        # 4. Converte as strings de data/hora para objetos datetime
        try:
            # Garanta que o frontend envia no formato ISO 8601 (ex: "2025-07-23T10:00:00")
            start_time = datetime.fromisoformat(start_time_str)
            end_time = datetime.fromisoformat(end_time_str)
        except ValueError:
            raise serializers.ValidationError({"time": "Formato de data/hora inválido. Use YYYY-MM-DDTHH:MM:SS."})

        # 5. Valida a lógica de tempo
        if end_time <= start_time:
            raise serializers.ValidationError({"time": "A hora de saída deve ser após a hora de entrada."})
        if start_time < timezone.now(): # Import timezone do django.utils
            raise serializers.ValidationError({"time": "Não é possível reservar uma vaga no passado."})

        # Exemplo BÁSICO de verificação de sobreposição (para uma vaga única):
        overlapping_reservations = Reservation.objects.filter(
            spot=spot,
            # Uma reserva existente começa antes do fim da nova E termina depois do início da nova
            start_time__lt=end_time,
            end_time__gt=start_time,
            status__in=['pending', 'confirmed'] # Considere status que bloqueiam a vaga
        ).exists()

        if overlapping_reservations:
            raise serializers.ValidationError({"spot": "A vaga já está reservada para parte ou todo o período selecionado."})
        # 7. Calcular o preço total
        duration_hours = Decimal((end_time - start_time).total_seconds()) / Decimal(3600)
        total_price = duration_hours * spot.price_hour
        total_price = total_price.quantize(Decimal('0.00'))

        # 8. Salvar a reserva com os dados calculados e o usuário logado
        serializer.save(
            renter=self.request.user, # O usuário logado é o 'renter'
            spot=spot, # A instância do spot encontrada
            start_time=start_time,
            end_time=end_time,
            total_price=total_price,
            status='pending' # Define o status inicial
        )

@csrf_exempt
def salvar_disponibilidade(request):
    if request.method == "POST":
        data = json.loads(request.body)

        spot_id = data.get("spot_id")
        availabilities_data = data.get("availabilities", [])

        try:
            spot = ParkingSpot.objects.get(id=spot_id)
        except ParkingSpot.DoesNotExist:
            return JsonResponse({"error": "Vaga não encontrada"}, status=404)

        # Apaga disponibilidades anteriores, se necessário
        Availability.objects.filter(spot=spot).delete()

        # Cria novas disponibilidades
        for item in availabilities_data:
            weekday = item.get("weekday")
            start = parse_time(item.get("start"))
            end = parse_time(item.get("end"))
            quantity = item.get("quantity", 1)

            Availability.objects.create(
                spot=spot,
                weekday=weekday,
                start=start,
                end=end,
                quantity=quantity
            )

        return JsonResponse({"success": True, "spot_id": spot.id})

    return JsonResponse({"error": "Método não permitido"}, status=405)

class ParkingSpotListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = ParkingSpotSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return ParkingSpot.objects.filter(status="Ativa")
    
    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
    
class MinhasVagasView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        spots = ParkingSpot.objects.filter(owner=request.user)
        serializer = ParkingSpotSerializer(spots, many=True)
        return Response(serializer.data)

class ParkingSpotViewSet(viewsets.ModelViewSet):
    queryset = ParkingSpot.objects.all()
    serializer_class = ParkingSpotSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

class SpotAvailabilityViewSet(viewsets.ModelViewSet):
    queryset = SpotAvailability.objects.all().order_by('available_date', 'start_time') 
    serializer_class = SpotAvailabilitySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    # Você pode querer filtrar por spot aqui
    def get_queryset(self):
        queryset = super().get_queryset()
        spot_id = self.request.query_params.get('spot_id', None)
        if spot_id is not None:
            queryset = queryset.filter(spot__id=spot_id)
        return queryset

class ParkingSpotDetailAPIView(RetrieveUpdateDestroyAPIView):
    queryset = ParkingSpot.objects.all()
    serializer_class = ParkingSpotSerializer

    def get_queryset(self):
        # Garantir que só o dono pode editar/excluir
        return self.queryset.filter(owner=self.request.user)
    
@csrf_exempt
def buscar_veiculos(request):
    caminho = os.path.join(os.path.dirname(__file__), "..", "veiculos.json")
    try:
        with open(caminho, "r", encoding="utf-8") as f:
            dados = json.load(f)
        return JsonResponse(dados, safe=False)
    except FileNotFoundError:
        return JsonResponse({"erro": "Arquivo de veículos não encontrado"}, status=404)
    
# --------------  CHAT  -----------------
@login_required
def chat_dashboard(request):
    conversations = (
        Conversation.objects
        .filter(Q(seller=request.user) | Q(buyer=request.user))
        .select_related('reservation__spot')
        .order_by('-last_message_at')
    )
    return render(request, 'parking/chat_dashboard.html', {
        'conversations': conversations
    })

@login_required
def chat_room(request, pk):
    conv = get_object_or_404(Conversation, pk=pk)
    if request.user not in (conv.seller, conv.buyer):
        raise Http404
    return render(request, 'parking/chat_room.html', {
        'conversation': conv
    })

@login_required
def send_message(request, pk):
    """AJAX POST – body: text=<mensagem>"""
    if request.method != 'POST':
        return JsonResponse({'error': 'invalid method'}, status=405)

    conv = get_object_or_404(Conversation, pk=pk)
    if request.user not in (conv.seller, conv.buyer):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    text = request.POST.get('text', '').strip()
    if not text:
        return JsonResponse({'error': 'empty'}, status=400)

    msg = Message.objects.create(
        conversation=conv,
        sender=request.user,
        text=text
    )

    # Atualiza o carimbo de “última mensagem” para ordenar no dashboard
    conv.last_message_at = timezone.now()
    conv.save(update_fields=['last_message_at'])

    return JsonResponse({
        'id': msg.id,
        'sender': msg.sender.username,
        'text': msg.text,
        'created_at': msg.created_at.strftime('%H:%M')
    }, status=201)


# --------------  API REST (opcional)  -----------------
class ParkingSpotListAPI(generics.ListAPIView):
    queryset = ParkingSpot.objects.all()
    serializer_class = ParkingSpotSerializer


# --------------  Views existentes  -----------------
def spots_list(request):
    return render(request, 'parking/list.html', {
        'GOOGLE_MAPS_API_KEY': settings.GOOGLE_MAPS_API_KEY,
    })

def registrar_usuario(request):
    if request.method == "POST":
        form = RegistroUsuarioForm(request.POST)
        if form.is_valid():
            user = User.objects.create_user(
                email=form.cleaned_data["email"],
                password=form.cleaned_data["password1"],
            )
            user.backend = 'parking.backends.EmailBackend'
            login(request, user)
            return redirect("parking:cadastrar_perfil")  # redireciona após login
    else:
        form = RegistroUsuarioForm()
    return render(request, "parking/registrar.html", {"form": form})

@login_required
def cadastrar_perfil(request):
    perfil_existente = Perfil.objects.filter(usuario=request.user).first()

    if perfil_existente:
        return redirect('parking:login')  # ou outra url de dashboard

    if request.method == "POST":
        form = PerfilForm(request.POST, request.FILES)
        if form.is_valid():
            perfil = form.save(commit=False)
            perfil.usuario = request.user
            perfil.save()
            return redirect('parking:login')  # depois de salvar o perfil
    else:
        form = PerfilForm()

    return render(request, "parking/cadastrar_perfil.html", {"form": form})


class CustomUserCreationForm(UserCreationForm):
    email = forms.EmailField(required=True)

    class Meta:
        model = User
        fields = ["email", "password1", "password2"]