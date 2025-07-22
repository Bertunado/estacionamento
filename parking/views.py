from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db.models import Q            # ←  Q vem do django.db.models
from django.http import JsonResponse, Http404
from django.shortcuts import render, get_object_or_404
from django.utils import timezone
from .serializers import ParkingSpotSerializer
from rest_framework import generics, permissions
from .forms import PerfilForm
from django.contrib.auth.forms import UserCreationForm
from django.shortcuts import redirect
from django.contrib.auth import get_user_model
from django.contrib.auth import login
from .forms import RegistroUsuarioForm
from django.contrib.auth import authenticate
from .models import Perfil
from django.views.decorators.csrf import csrf_exempt
from django import forms
import os
import json
from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import RetrieveUpdateDestroyAPIView
from .models import ParkingSpotPhoto
from .serializers import ParkingSpotPhotoSerializer
from .models import Availability
from django.utils.dateparse import parse_time
import logging
import requests

from .models import (
    ParkingSpot,
    Conversation,
    Message,
)

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
    queryset = ParkingSpotPhoto.objects.all()
    serializer_class = ParkingSpotPhotoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ParkingSpot.objects.filter(status="Ativa")

    def perform_create(self, serializer):
        spot = serializer.save(owner=self.request.user)

        disponibilidades_raw = self.request.data.get("disponibilidades")
        if disponibilidades_raw:
            try:
                disponibilidades = json.loads(disponibilidades_raw)
                for d in disponibilidades:
                    Availability.objects.create(
                        spot=spot,
                        weekday=diasSemanaParaInt(d["dia"]),  # convertendo nome para número
                        start=d["hora_inicio"],
                        end=d["hora_fim"]
                    )
            except Exception as e:
                print("Erro ao salvar disponibilidade:", e)

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