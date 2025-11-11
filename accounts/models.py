import random
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

class CustomUserManager(BaseUserManager):
    
    def create_user(self, email, password=None, **extra_fields):
        """
        Cria e salva um usuário com o email e senha fornecidos.
        """
        if not email:
            raise ValueError('O Email é obrigatório')
        email = self.normalize_email(email)
        
        # Define os valores padrão (usuário comum começa inativo)
        extra_fields.setdefault('is_active', False)
        
        # Gera o código de verificação se não for um superusuário
        if 'email_verification_code' not in extra_fields:
             extra_fields['email_verification_code'] = str(random.randint(100000, 999999))
        
        # Cria o modelo de usuário
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """
        Cria e salva um superusuário.
        """
        # Define os campos do superusuário. 
        # Estes valores sobrepõem os padrões do create_user.
        extra_fields['is_staff'] = True
        extra_fields['is_superuser'] = True
        extra_fields['is_active'] = True  # Superusuário sempre começa ativo
        extra_fields['is_email_verified'] = True # E verificado
        extra_fields['email_verification_code'] = None # Não precisa de código

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        # Chama o create_user com os campos já definidos
        return self.create_user(email, password, **extra_fields)

class CustomUser(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    is_active = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    is_superuser = models.BooleanField(default=False)

    email_verification_code = models.CharField(max_length=6, blank=True, null=True)
    is_email_verified = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    def __str__(self):
        return self.email