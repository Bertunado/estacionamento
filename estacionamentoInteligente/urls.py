from django.contrib import admin
from django.urls import path, include
from parking.views import home
from django.conf import settings
from django.conf.urls.static import static 

urlpatterns = [
    path('admin/', admin.site.urls),
    path('parking/', include(('parking.urls', 'parking'), namespace='parking')),
    path('home/', home, name='home'),
]

if settings.DEBUG:
    # Esta linha é essencial para servir os arquivos que estão em STATICFILES_DIRS
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

    # E esta para arquivos de mídia
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)