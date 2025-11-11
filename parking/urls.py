# parking/urls.py

from django.urls import path, include
from . import views
from django.contrib.auth import views as auth_views
from .forms import EmailAuthenticationForm

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
    path('api/', include('parking.api_urls')),
    path('logout/', auth_views.LogoutView.as_view(next_page='parking:login'), name='logout'),
    path("verificar-codigo/", views.verificar_codigo, name="verificar_codigo"),

    # URLs de autenticação do Django
    path('login/', auth_views.LoginView.as_view(
        template_name='parking/login.html',
        authentication_form=EmailAuthenticationForm
    ), name='login'),
    
]