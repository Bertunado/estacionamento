from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse, Http404
from django.shortcuts import render, get_object_or_404, redirect
from django.utils import timezone
from .serializers import ParkingSpotSerializer, ReservationSerializer, ParkingSpotPhotoSerializer, SpotAvailabilitySerializer
from rest_framework import generics, permissions, serializers, viewsets, status
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
from rest_framework.decorators import api_view, permission_classes
from django.utils.dateparse import parse_date

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
        print("=== Dados recebidos para criar reserva ===")
        print(self.request.data)
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
        
class SpotReservationsListView(generics.ListAPIView):
    serializer_class = ReservationSerializer

    def get_queryset(self):
        spot_id = self.kwargs['spot_id']
        date_str = self.request.query_params.get('date', None)
        slot_number = self.request.query_params.get('slot_number', None) # ✅ Adicione o slot_number

        queryset = Reservation.objects.filter(spot_id=spot_id)

        if date_str:
            queryset = queryset.filter(start_time__date=date_str)
        
        # ✅ Filtra por slot_number se ele for fornecido
        if slot_number:
            queryset = queryset.filter(slot_number=slot_number)
        
        return queryset.order_by('start_time')
            
class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.all()
    serializer_class = ReservationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Um usuário só pode ver as reservas que ele fez (como renter)
        return Reservation.objects.filter(renter=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        print("=== Dados recebidos para criar reserva ===")
        print(self.request.data)
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
            start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
            end_time = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
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

class MyReservationsListView(generics.ListAPIView):
    queryset = Reservation.objects.all()
    serializer_class = ReservationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Reservation.objects.filter(renter=self.request.user)
    
class SpotAvailabilityViewSet(viewsets.ModelViewSet):
    queryset = SpotAvailability.objects.all()
    serializer_class = SpotAvailabilitySerializer

class ReservationCreateView(generics.CreateAPIView):
    serializer_class = ReservationSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        spot_id = self.request.data.get('spot')
        slot_number = self.request.data.get('slot_number')
        start_time = self.request.data.get('start_time')
        end_time = self.request.data.get('end_time')

        if not all([spot_id, slot_number, start_time, end_time]):
            raise serializers.ValidationError({"detail": "Spot, slot_number, start_time e end_time são obrigatórios."})

        spot = get_object_or_404(ParkingSpot, pk=spot_id)
        start_time = timezone.make_aware(datetime.fromisoformat(start_time))
        end_time = timezone.make_aware(datetime.fromisoformat(end_time))

        # Verifica sobreposição para a vaga física
        overlapping = Reservation.objects.filter(
            spot=spot,
            start_time__lt=end_time,
            end_time__gt=start_time,
            status__in=['pending', 'confirmed']
        ).exists()

        if overlapping:
            raise serializers.ValidationError(
                {"detail": f"Já existe uma reserva para este estacionamento entre {start_time.isoformat()} e {end_time.isoformat()}."}
        )

        duration_hours = (end_time - start_time).total_seconds() / 3600
        total_price = round(duration_hours * spot.hourly_price, 2)

        serializer.save(
            renter=self.request.user,
            spot=spot,
            slot_number=slot_number,
            start_time=start_time,
            end_time=end_time,
            total_price=total_price,
            status='pending'
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

        # APAGA TODAS AS DISPONIBILIDADES EXISTENTES PARA ESTE SPOT
        SpotAvailability.objects.filter(spot=spot).delete() 

        for item in availabilities_data:
            available_date_str = item.get("available_date")
            start_time_str = item.get("start_time")
            end_time_str = item.get("end_time")
            available_quantity = item.get("available_quantity", 1) 

            if not all([available_date_str, start_time_str, end_time_str, available_quantity is not None]):
                logger.error(f"Dados incompletos para SpotAvailability (salvar): {item}")
                continue

            try:
                # Parsear a data para objeto date
                available_date = datetime.strptime(available_date_str, '%Y-%m-%d').date()
                # Parsear os horários
                start_time = parse_time(start_time_str)
                end_time = parse_time(end_time_str)
            except (ValueError, TypeError) as e:
                logger.error(f"Erro de formato de data/hora ou tipo em SpotAvailability ao salvar: {e}, dados: {item}")
                continue

            # Cria o registro no modelo
            SpotAvailability.objects.create(
                spot=spot,
                available_date=available_date,
                start_time=start_time,
                end_time=end_time,
                available_quantity=available_quantity
            )
        return JsonResponse({"success": True, "spot_id": spot.id}, status=200)
    return JsonResponse({"error": "Método não permitido"}, status=405)

class ParkingSpotListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = ParkingSpotSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return ParkingSpot.objects.filter(status="Ativa")
    
    def perform_create(self, serializer):
        print("=== Dados recebidos para criar reserva ===")
        print(self.request.data)
        serializer.save(owner=self.request.user)
    
class MinhasVagasView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        spots = ParkingSpot.objects.filter(owner=request.user)
        serializer = ParkingSpotSerializer(spots, many=True)
        return Response(serializer.data)

class ParkingSpotViewSet(viewsets.ModelViewSet):
    serializer_class = ParkingSpotSerializer
    queryset = ParkingSpot.objects.all().select_related('owner', 'owner__perfil')
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.action == 'list':  # apenas no GET /spots/
            return ParkingSpot.objects.filter(status="Ativa")
        return ParkingSpot.objects.all()

    def perform_create(self, serializer):
        print("=== Dados recebidos para criar vaga ===")
        print(self.request.data)  # Adicione esta linha
        serializer.save(owner=self.request.user)
    
    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        print("Serialização do spot:", response.data)  # aqui está o JSON serializado que vai pro frontend
        return response


class SpotAvailabilityView(generics.ListAPIView):
    serializer_class = SpotAvailabilitySerializer

    def get_queryset(self):
        spot_id = self.kwargs["spot_id"]
        date_str = self.request.query_params.get("date")
        if not date_str:
            return Reservation.objects.none()

        date_obj = parse_date(date_str)
        if not date_obj:
            return Reservation.objects.none()

        # Apenas reservas da vaga informada e dessa data
        return Reservation.objects.filter(
            spot_id=spot_id,
            start_time__date=date_obj
        )
    
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_spot_availability_by_spot_id(request, spot_id):
    try:
        spot = ParkingSpot.objects.get(pk=spot_id)
    except ParkingSpot.DoesNotExist:
        return Response({'detail': 'Vaga de estacionamento (Spot) não encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    dates_param = request.query_params.get('dates', None)
    if not dates_param:
        return Response({'detail': 'Parâmetro "dates" é obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)

    date_strings = dates_param.split(',')
    response_data = {
        'spot_id': spot.id,
        'capacity': spot.quantity,
        'dates_availability': []
    }

    for date_str in date_strings:
        try:
            query_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            availability = SpotAvailability.objects.filter(spot=spot, available_date=query_date).first()

            slots_info = []

            if availability:
                num_slots = availability.available_quantity
                for i in range(1, num_slots + 1):
                    # ✅ CORREÇÃO: Busque todas as reservas para o slot e a data
                    reservations = Reservation.objects.filter(
                        spot=spot,
                        slot_number=i,
                        start_time__date=query_date,
                        status__in=['pending', 'confirmed']
                    ).order_by('start_time')

                    occupied_times = []
                    for res in reservations:
                        occupied_times.append({
                            'start': res.start_time.strftime('%H:%M'),
                            'end': res.end_time.strftime('%H:%M')
                        })
                    
                    slots_info.append({
                        "slot_number": i,
                        "occupied_times": occupied_times
                    })
            
            response_data['dates_availability'].append({
                'date': date_str,
                'slots': slots_info,
            })

        except ValueError:
            response_data['dates_availability'].append({
                'date': date_str,
                'slots': [],
                'error': 'Formato de data inválido'
            })

    return Response(response_data, status=status.HTTP_200_OK)

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