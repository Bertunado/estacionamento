from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse, Http404
from django.shortcuts import render, get_object_or_404, redirect
from django.utils import timezone
from .serializers import ParkingSpotSerializer, ReservationSerializer, ParkingSpotPhotoSerializer, SpotAvailabilitySerializer, ReservationListSerializer
from rest_framework import generics, permissions, serializers, viewsets, status
from .forms import PerfilForm, RegistroUsuarioForm
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import get_user_model, login
from .models import Perfil, ParkingSpot, ParkingSpotPhoto, SpotAvailability, Reservation, Conversation,  Message
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
from django.views.decorators.http import require_http_methods
from django.core.mail import send_mail
import random
from django.contrib import messages
import threading

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
    conversations = (
        Conversation.objects
        .filter(Q(seller=request.user) | Q(buyer=request.user))
        .select_related('reservation__spot', 'seller__perfil', 'buyer__perfil')
        .order_by('-last_message_at')
    )
     
    perfil = Perfil.objects.filter(usuario=request.user).first()
    return render(request, 'parking/home.html', {
        'conversations': conversations,
        'perfil': perfil
    })

class ParkingSpotPhotoViewSet(viewsets.ModelViewSet):
    queryset = ParkingSpotPhoto.objects.all() # Queryset padrão para listar todas as fotos
    serializer_class = ParkingSpotPhotoSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser] # Para lidar com uploads de arquivos

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
            # 2. Encontra a instância do ParkingSpot e verifique se pertence ao usuário logado
            spot_instance = ParkingSpot.objects.get(id=spot_id_from_request, owner=self.request.user)
            
            # 3. Salva a foto associando-a à instância do spot
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
        slot_number = self.request.query_params.get('slot_number', None) 

        queryset = Reservation.objects.filter(spot_id=spot_id)

        if date_str:
            queryset = queryset.filter(start_time__date=date_str)
        
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
        slot_number = self.request.data.get('slot_number')
        if slot_number is not None:
            try:
                slot_number = int(slot_number)
            except ValueError:
                raise serializers.ValidationError({"slot_number": "O número do slot deve ser um inteiro válido."})

        # 2. Valida se os dados essenciais estão presentes
        if not all([spot_id, start_time_str, end_time_str]):
            raise serializers.ValidationError({"detail": "Dados de reserva incompletos (spot, start_time, end_time são obrigatórios)."})

        # 3. Encontra a instância da vaga (ParkingSpot)
        try:
            spot = ParkingSpot.objects.get(id=spot_id)
        except ParkingSpot.DoesNotExist:
            raise serializers.ValidationError({"spot": "Vaga de estacionamento não encontrada."})
        
        if spot.owner == self.request.user:
            raise serializers.ValidationError({"detail": "Você não pode reservar sua própria vaga."})

        # 4. Converte as strings de data/hora para objetos datetime
        try:
            start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
            end_time = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
        except ValueError:
            raise serializers.ValidationError({"time": "Formato de data/hora inválido. Use YYYY-MM-DDTHH:MM:SS."})

        # 5. Valida a lógica de tempo
        if end_time <= start_time:
            raise serializers.ValidationError({"time": "A hora de saída deve ser após a hora de entrada."})
        if start_time < timezone.now(): # Import timezone do django.utils
            raise serializers.ValidationError({"time": "Não é possível reservar uma vaga no passado."})
        if slot_number is None:
            raise serializers.ValidationError({"slot_number": "O número do slot é obrigatório."})

        # Verificação de sobreposição (para uma vaga única):
        overlapping_reservations = Reservation.objects.filter(
            spot=spot,
            # Uma reserva existente começa antes do fim da nova E termina depois do início da nova
            slot_number=slot_number,
            start_time__lt=end_time,
            end_time__gt=start_time,
            status__in=['pending', 'confirmed']
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

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.renter != request.user:
            return Response(
            {   'detail': 'Você não tem permissão para cancelar esta reserva.'},
                status=status.HTTP_403_FORBIDDEN
            )
    
    # O cancelamento é feito simplesmente deletando o objeto
        instance.delete()
    
    # O retorno HTTP 204 indica sucesso, mas sem conteúdo de resposta
        return Response(status=status.HTTP_204_NO_CONTENT)

class MyReservationsListView(generics.ListAPIView):
    queryset = Reservation.objects.all()
    serializer_class = ReservationListSerializer 
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Reservation.objects.filter(renter=self.request.user).select_related('spot', 'spot__owner', 'spot__owner__perfil').order_by('-created_at')
    
class SpotAvailabilityViewSet(viewsets.ModelViewSet):
    queryset = SpotAvailability.objects.all()
    serializer_class = SpotAvailabilitySerializer

class ReservationCreateView(generics.CreateAPIView):
    serializer_class = ReservationSerializer
    permission_classes = [IsAuthenticated]

    # Sobrescreva o método `create` para incluir a validação
    def create(self, request, *args, **kwargs):
        # 1. Validação de dados de entrada
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        spot_id = serializer.validated_data.get('spot').id
        start_time = serializer.validated_data.get('start_time')
        end_time = serializer.validated_data.get('end_time')

        # 2. Lógica de validação personalizada (sobreposição de horário)
        overlapping = Reservation.objects.filter(
            spot_id=spot_id,
            start_time__lt=end_time,
            end_time__gt=start_time,
            status__in=['pending', 'confirmed']
        ).exists()

        if overlapping:
            # Retorna a resposta de erro diretamente
            return Response(
                {"detail": "Já existe uma reserva para este estacionamento neste período."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Se a validação personalizada passar, salva o objeto
        self.perform_create(serializer)
        
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        # A lógica de validação já foi feita no método `create`
        # Aqui apenas salvo o objeto com os dados adicionais
        duration_hours = (serializer.validated_data['end_time'] - serializer.validated_data['start_time']).total_seconds() / 3600
        total_price = round(duration_hours * serializer.validated_data['spot'].hourly_price, 2)
        
        serializer.save(
            renter=self.request.user,
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
        return ParkingSpot.objects.filter(status="Ativa").select_related('owner', 'owner__perfil')
    
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
        if self.action == 'list': 
            return ParkingSpot.objects.filter(status="Ativa").select_related('owner', 'owner__perfil')
        return ParkingSpot.objects.all()

    def perform_create(self, serializer):
        print("=== Dados recebidos para criar vaga ===")
        print(self.request.data) 
        serializer.save(owner=self.request.user)
    
    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        print("Dados do spot enviados pela API:", response.data)
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
            day_start_time = None
            day_end_time = None

            if availability:

                day_start_time = availability.start_time.strftime('%H:%M')
                day_end_time = availability.end_time.strftime('%H:%M')

                num_slots = availability.available_quantity
                for i in range(1, num_slots + 1):
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
                'day_start_time': day_start_time,
                'day_end_time': day_end_time,
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
    
# CHAT 
@login_required
def chat_dashboard(request):
    conversations = (
        Conversation.objects
        .filter(Q(seller=request.user) | Q(buyer=request.user))
        .select_related('reservation__spot', 'seller__perfil', 'buyer__perfil')
        .order_by('-last_message_at')
    )
    return render(request, 'parking/chat_unified.html', {
        'conversations': conversations
    })


@login_required
def chat_room(request, pk):
    return redirect('parking:chat_dashboard') 

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
        'sender_id': msg.sender.id,
        'sender_username': msg.sender.perfil.nome_completo or msg.sender.email,
        'text': msg.text,
        'created_at': msg.created_at.strftime('%H:%M')
    }, status=201)

@login_required
def get_messages(request, pk):
    conv = get_object_or_404(Conversation, pk=pk)
    if request.user not in (conv.seller, conv.buyer):
        return JsonResponse({'error': 'unauthorized'}, status=403)
    
    messages = conv.messages.all().order_by('created_at').select_related('sender')
    
    messages_list = [{
        'sender_id': m.sender.id,
        'sender_username': m.sender.perfil.nome_completo or m.sender.email,
        'text': m.text,
        'created_at': m.created_at.strftime('%H:%M')
    } for m in messages]
    
    return JsonResponse(messages_list, safe=False)

@require_http_methods(["DELETE"])
def delete_conversation(request, pk):
    """
    Exclui uma conversa de chat.
    """
    try:
        conv = get_object_or_404(Conversation, pk=pk)
        
        # Apenas o comprador ou o vendedor podem excluir a conversa
        if request.user not in (conv.seller, conv.buyer):
            return JsonResponse({'error': 'unauthorized'}, status=403)
        
        conv.delete()
        return JsonResponse({'success': 'Conversation deleted'}, status=200)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
    
@login_required
def get_conversations_api(request):
    """
    Retorna a lista de conversas do usuário logado em formato JSON.
    """
    conversations = (
        Conversation.objects
        .filter(Q(seller=request.user) | Q(buyer=request.user))
        .select_related('reservation__spot', 'seller__perfil', 'buyer__perfil')
        .order_by('-last_message_at')
    )
    
    conversation_list = []
    for conv in conversations:
        other_user = conv.buyer if request.user == conv.seller else conv.seller
        
        # --- INÍCIO DA CORREÇÃO ---
        
        # 1. Define valores padrão
        other_user_name = other_user.email # Padrão é o email
        # Define um caminho padrão para a foto (use o seu caminho correto)
        other_user_photo_url = f'{settings.STATIC_URL}parking/css/images/default_avatar.png'

        # 2. Verifica se o 'perfil' existe (evita crash)
        if hasattr(other_user, 'perfil') and other_user.perfil:
            # Se existe, usa o nome completo (ou o email se o nome estiver vazio)
            other_user_name = other_user.perfil.nome_completo or other_user.email
            
            # 3. Verifica se o campo 'foto' NÃO está vazio ANTES de ler o .url
            if other_user.perfil.foto: 
                other_user_photo_url = other_user.perfil.foto.url
        
        # --- FIM DA CORREÇÃO ---

        # 4. Adiciona os dados seguros à lista
        conversation_list.append({
            'id': conv.id,
            'title': conv.reservation.spot.title,
            'other_user_name': other_user_name, # Usa a variável segura
            'other_user_photo_url': other_user_photo_url, # Usa a variável segura
        })
        
    return JsonResponse(conversation_list, safe=False)

# API REST (opcional)
class ParkingSpotListAPI(generics.ListAPIView):
    queryset = ParkingSpot.objects.all()
    serializer_class = ParkingSpotSerializer
    
def spots_list(request):
    return render(request, 'parking/list.html', {
        'GOOGLE_MAPS_API_KEY': settings.GOOGLE_MAPS_API_KEY,
    })

def send_verification_email_async(subject, message, from_email, recipient_list):
    """ Envia e-mail em uma thread separada para não bloquear a view """
    try:
        send_mail(subject, message, from_email, recipient_list, fail_silently=False)
        print(f"E-mail de verificação (via SendGrid) enviado para {recipient_list[0]}")
    except Exception as e:
        # Em uma thread, não podemos falar com o usuário.
        # Apenas registramos o erro no console.
        print(f"ERRO CRÍTICO AO ENVIAR E-MAIL (em background): {e}")

def registrar_usuario(request):
    if request.method == "POST":
        form = RegistroUsuarioForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.email = form.cleaned_data["email"]
            user.set_password(form.cleaned_data["password1"])
            user.is_active = False 
            
            if not user.email_verification_code:
                 user.email_verification_code = str(random.randint(100000, 999999))
            
            user.save()

            # --- LÓGICA DE E-MAIL MODIFICADA ---
            # 3. USE A THREAD PARA CHAMAR A FUNÇÃO
            
            subject = 'Seu Código de Verificação do Estacionamento Inteligente'
            message = f'Olá! Seu código para ativar a conta Estacionamento Inteligente é: {user.email_verification_code}'
            
            # Cria a thread
            email_thread = threading.Thread(
                target=send_verification_email_async,
                args=(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
            )
            # Inicia a thread (a view não vai esperar por isso)
            email_thread.start()
            
            # --- FIM DA MODIFICAÇÃO ---
            
            # A view continua IMEDIATAMENTE para cá
            request.session['user_id_to_verify'] = user.id
            return redirect('parking:verificar_codigo')
    else:
        form = RegistroUsuarioForm()
    return render(request, "parking/registrar.html", {"form": form})

def verificar_codigo(request):
    try:
        # Pega o ID do usuário que acabamos de registrar (guardado na sessão)
        user_id = request.session['user_id_to_verify']
        user = User.objects.get(id=user_id)
    except (KeyError, User.DoesNotExist):
        messages.error(request, "Sessão inválida ou usuário não encontrado. Por favor, tente se registrar novamente.")
        return redirect('parking:registrar')

    if request.method == 'POST':
        code = request.POST.get('verification_code')
        
        if code == user.email_verification_code:
            # SUCESSO!
            user.is_active = True
            user.is_email_verified = True
            user.email_verification_code = None # Limpa o código para segurança
            user.save()
            
            # Limpa o ID da sessão
            del request.session['user_id_to_verify']
            
            # Loga o usuário
            user.backend = 'parking.backends.EmailBackend' # Precisa disso!
            login(request, user)
            
            # Envia para o próximo passo
            return redirect('parking:cadastrar_perfil')
        else:
            # CÓDIGO ERRADO
            messages.error(request, 'Código inválido. Tente novamente.')
            return render(request, 'parking/verificar_codigo.html')

    # Se for método GET, apenas mostra a página
    return render(request, 'parking/verificar_codigo.html')

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

class MySpotReservationRequestsView(generics.ListAPIView):
    """
    API para o vendedor (owner) ver as solicitações de reserva pendentes
    para suas próprias vagas.
    """
    serializer_class = ReservationListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Retorna reservas de vagas que pertencem ao usuário logado
        # E que tenham o status 'pending'
        return Reservation.objects.filter(
            spot__owner=self.request.user, 
            status='pending'
        ).select_related('spot', 'renter', 'renter__perfil').order_by('created_at')


class UpdateReservationStatusView(APIView):
    """
    API para o vendedor (owner) aprovar ou recusar uma solicitação.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, *args, **kwargs):
        try:
            # Otimizado: select_related para buscar dados do usuário e vaga de uma vez
            reservation = Reservation.objects.select_related('renter', 'spot', 'spot__owner').get(pk=pk)
        except Reservation.DoesNotExist:
            return Response({"detail": "Reserva não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        # 1. Verificação de Segurança
        if reservation.spot.owner != request.user:
            return Response(
                {"detail": "Você não tem permissão para modificar esta reserva."}, 
                status=status.HTTP_403_FORBIDDEN
            )

        action = request.data.get('action') # 'approve' ou 'refuse'
        
        # Dados para o E-mail
        renter_email = reservation.renter.email
        spot_title = reservation.spot.title

        if action == 'approve':
            # 2. Verificação de Conflito
            overlapping_reservations = Reservation.objects.filter(
                spot=reservation.spot,
                slot_number=reservation.slot_number,
                start_time__lt=reservation.end_time,
                end_time__gt=reservation.start_time,
                status='confirmed'
            ).exclude(pk=reservation.pk).exists()

            if overlapping_reservations:
                return Response(
                    {"detail": "Não é possível aprovar. Já existe uma reserva confirmada neste horário para este slot."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 3. Aprova a reserva
            reservation.status = 'confirmed'
            reservation.save(update_fields=['status'])
            
            # --- INÍCIO DA ATUALIZAÇÃO (E-MAIL DE APROVAÇÃO) ---
            try:
                send_mail(
                    subject=f'Sua reserva para "{spot_title}" foi CONFIRMADA!',
                    message=(
                        f'Olá!\n\n'
                        f'Boas notícias! Sua solicitação de reserva para a vaga "{spot_title}" foi APROVADA pelo proprietário.\n\n'
                        f'Detalhes:\n'
                        f'- Data: {reservation.start_time.strftime("%d/%m/%Y")}\n'
                        f'- Horário: {reservation.start_time.strftime("%H:%M")} às {reservation.end_time.strftime("%H:%M")}\n\n'
                        f'Você pode ver os detalhes na seção "Minhas Reservas" e iniciar o chat com o proprietário.\n\n'
                        f'Obrigado por usar o Estacionamento Inteligente!'
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL, # O e-mail configurado no settings.py
                    recipient_list=[renter_email], # O e-mail do locatário
                    fail_silently=False, # Força a falha para o 'except' pegar
                )
            except Exception as e:
                # O Erro 500 estava vindo daqui.
                # Agora, apenas imprimimos o erro, mas a API continua.
                print(f"!!! ERRO AO ENVIAR E-MAIL de confirmação (Reserva ID: {pk}): {e}")
            # --- FIM DA ATUALIZAÇÃO ---

            serializer = ReservationListSerializer(reservation)
            return Response(serializer.data, status=status.HTTP_200_OK)

        elif action == 'refuse':
            # 4. Recusa a reserva
            reservation.status = 'refused'
            reservation.save(update_fields=['status'])
            
            # --- INÍCIO DA ATUALIZAÇÃO (E-MAIL DE RECUSA) ---
            try:
                send_mail(
                    subject=f'Atualização sobre sua reserva para "{spot_title}"',
                    message=(
                        f'Olá!\n\n'
                        f'Infelizmente, sua solicitação de reserva para a vaga "{spot_title}" foi RECUSADA pelo proprietário.\n\n'
                        f'Você pode tentar reservar um horário diferente para esta ou outra vaga.\n\n'
                        f'Equipe Estacionamento Inteligente.'
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[renter_email],
                    fail_silently=False,
                )
            except Exception as e:
                print(f"!!! ERRO AO ENVIAR E-MAIL de recusa (Reserva ID: {pk}): {e}")
            # --- FIM DA ATUALIZAÇÃO ---

            serializer = ReservationListSerializer(reservation)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        else:
            return Response({"detail": "Ação inválida. Envie 'approve' ou 'refuse'."}, status=status.HTTP_400_BAD_REQUEST)