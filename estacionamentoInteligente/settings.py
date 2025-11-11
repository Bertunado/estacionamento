from pathlib import Path
import os
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-up*sx#if(&6zvy3%5nds%e_j$q9#$$f31rsar6nv_pvy&*!v&p'


ALLOWED_HOSTS = []

DEBUG = True

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    "rest_framework",
    'rest_framework.authtoken',
    "django_filters",
    "channels",     
    "corsheaders",
    'accounts',
    'parking',
    "booking",
    "payments",
    "reviews",
    "support",
    'your_app',
    'estacionamentoInteligente',
    'widget_tweaks',
]



MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'estacionamentoInteligente.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'django.template.context_processors.static',
            ],
        },
    },
]

WSGI_APPLICATION = 'estacionamentoInteligente.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'accounts.CustomUser'

STATIC_URL = 'static/'

STATICFILES_DIRS = [
    # Isso instrui o Django a procurar diretamente dentro da pasta 'static' do seu app 'parking'.
    # O {% static 'parking/js/main.js' %} buscará 'parking/js/main.js' dentro dessas pastas listadas.
    os.path.join(BASE_DIR, 'parking', 'static'),
]

STATIC_ROOT = BASE_DIR / 'staticfiles_collected'

LOGIN_URL = '/parking/login/'

LOGIN_REDIRECT_URL = '/home/' #redirecionar após login

LOGOUT_REDIRECT_URL = '/parking/login/'

GOOGLE_MAPS_API_KEY = 'AIzaSyCIksVaLbJTz4VIoPUk3wD2gqEi6Q72qk4'

AUTO_DEV_API_KEY = "ZrQEPSkKYmVybmFyZG92aWFuYTIwMDVAZ21haWwuY29t"

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'parking.backends.EmailBackend',  
]

MEDIA_URL = '/media/'

MEDIA_ROOT = BASE_DIR / 'media'

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': None,
}

CSRF_COOKIE_HTTPONLY = False

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.sendgrid.net'
EMAIL_PORT = 2525
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'apikey' # IMPORTANTE: É a palavra "apikey" mesmo
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = 'bolsonarosantos54@gmail.com'


