from django.contrib import admin
from django.urls import path, include
from parking.views import home
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('parking/', include(('parking.urls', 'parking'), namespace='parking')),
    path('home/', home, name='home'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)