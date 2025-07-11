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
import logging
import requests

from .models import (
    ParkingSpot,
    Conversation,
    Message,
)

User = get_user_model()
logger = logging.getLogger(__name__)

@login_required
def home(request):
    perfil = Perfil.objects.filter(usuario=request.user).first()
    return render(request, 'parking/home.html', {
        'perfil': perfil
    })

class ParkingSpotListCreateAPIView(generics.ListCreateAPIView):
    """
    GET  /api/spots/   → lista todas as vagas
    POST /api/spots/   → cria nova vaga (JSON)
    """
    queryset = ParkingSpot.objects.all()
    serializer_class = ParkingSpotSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
    
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