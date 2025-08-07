# parking/urls.py

from django.urls import path, include
from . import views
from django.contrib.auth import views as auth_views
from .forms import EmailAuthenticationForm
from rest_framework.routers import DefaultRouter 
from rest_framework.authtoken.views import obtain_auth_token
from .views import get_spot_availability_by_spot_id

router = DefaultRouter()
router.register(r'spots', views.ParkingSpotViewSet, basename='parking_spot') 
router.register(r'photos', views.ParkingSpotPhotoViewSet, basename='parking_spot_photo')
router.register(r'reservations', views.ReservationViewSet, basename='reservation')
router.register(r'spot-availabilities', views.SpotAvailabilityViewSet, basename='spot_availability') 

app_name = 'parking' 

urlpatterns = [
    # URLs para as páginas e formulários (não API REST)
    path("", views.spots_list, name="spots_list"),
    path("chat/", views.chat_dashboard, name="chat_dashboard"),
    path("chat/<int:pk>/", views.chat_room, name="chat_room"),
    path("chat/<int:pk>/send/", views.send_message, name="chat_send"),
    path("perfil/cadastrar/", views.cadastrar_perfil, name="cadastrar_perfil"),
    path("registrar/", views.registrar_usuario, name="registrar"),
    path('perfil/buscar-veiculos/', views.buscar_veiculos, name='buscar_veiculos'),
    path('salvar-disponibilidade/', views.salvar_disponibilidade, name='salvar_disponibilidade'),
    path('api/token/login/', obtain_auth_token, name='api_token_auth'), # Endpoint para obter o token
    
    # URL de logout correta.
    # Note que a URL é a primeira a ser processada e aponta para a página de login correta.
    path('logout/', auth_views.LogoutView.as_view(next_page='parking:login'), name='logout'),


    path('api/spots/<int:spot_id>/availability/', get_spot_availability_by_spot_id, name='spot-availability-by-spot-id'),

    path('api/minhas-vagas/', views.MinhasVagasView.as_view(), name='minhas_vagas_api'),
    
    # URLs de autenticação do Django
    path('login/', auth_views.LoginView.as_view(
        template_name='parking/login.html',
        authentication_form=EmailAuthenticationForm
    ), name='login'),

    # Inclui as URLs geradas pelo router (para todos os ViewSets REST)
    path('api/', include(router.urls)), 
    
]