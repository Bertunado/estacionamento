from django.urls import path
from .views import spots_list
from .views import ParkingSpotListCreateAPIView
from . import views
from django.contrib.auth import views as auth_views
from .forms import EmailAuthenticationForm
from django.contrib.auth.views import LogoutView
from .views import MinhasVagasView



app_name = 'parking'

urlpatterns = [
    path("",               spots_list,                   name="spots_list"),
    path("api/spots/",     ParkingSpotListCreateAPIView.as_view(), 
         name="api_spots"),
    path("chat/",          views.chat_dashboard,         name="chat_dashboard"),
    path('login/', auth_views.LoginView.as_view(
        template_name='parking/login.html',
        authentication_form=EmailAuthenticationForm
    ), name='login'),
    path('logout/', auth_views.LogoutView.as_view(next_page='login'), name='logout'),
    path("chat/<int:pk>/", views.chat_room,              name="chat_room"),
    path("chat/<int:pk>/send/", views.send_message,      name="chat_send"),
    path("perfil/cadastrar/", views.cadastrar_perfil, name="cadastrar_perfil"),
    path("registrar/", views.registrar_usuario, name="registrar"),
    path('perfil/buscar-veiculos/', views.buscar_veiculos, name='buscar_veiculos'),
    path('api/minhas-vagas/', MinhasVagasView.as_view(), name='minhas-vagas'),
]