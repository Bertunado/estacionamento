from django.contrib import admin
from .models import Perfil
from .models import ParkingSpot

@admin.register(Perfil)
class PerfilAdmin(admin.ModelAdmin):
    list_display = ['usuario', 'nome_completo', 'telefone', 'modelo_veiculo']

@admin.register(ParkingSpot)
class ParkingSpotAdmin(admin.ModelAdmin):
    list_display = ('title', 'address', 'owner', 'quantity', 'status') # Campos para exibir na lista
    list_filter = ('status', 'owner') # Filtros na barra lateral
    search_fields = ('title', 'address') # Campos para busca