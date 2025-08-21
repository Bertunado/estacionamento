# parking/api_urls.py - Versão corrigida

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from . import views
from .views import (
    MyReservationsListView, 
    SpotReservationsListView,
    get_spot_availability_by_spot_id,
    get_messages,
    send_message,
    delete_conversation,
)

router = DefaultRouter()
router.register(r'spots', views.ParkingSpotViewSet, basename='parking_spot') 
router.register(r'photos', views.ParkingSpotPhotoViewSet, basename='parking_spot_photo')
router.register(r'reservations', views.ReservationViewSet, basename='reservation')
router.register(r'spot-availabilities', views.SpotAvailabilityViewSet, basename='spot_availability') 

urlpatterns = [
    # Inclua as rotas do router primeiro para garantir que elas sejam encontradas
    path('', include(router.urls)),

    # Em seguida, inclua as views de API personalizadas
    path('token/login/', obtain_auth_token, name='api_token_auth'), 
    path('my-reservations/', MyReservationsListView.as_view(), name='my-reservations-list'),
    path('parking-spots/<int:spot_id>/reservations/', SpotReservationsListView.as_view(), name='spot-reservations-list'),
    path('spots/<int:spot_id>/availability/', get_spot_availability_by_spot_id, name='spot-availability-by-spot-id'),
    path('minhas-vagas/', views.MinhasVagasView.as_view(), name='minhas_vagas_api'),
    path('conversations/', views.get_conversations_api, name='api_get_conversations'),
    path('chat/<int:pk>/messages/', views.get_messages, name='api_get_messages'),
    path('chat/<int:pk>/send/', views.send_message, name='api_send_message'),
    path('chat/<int:pk>/delete/', views.delete_conversation, name='api_delete_conversation'),
]