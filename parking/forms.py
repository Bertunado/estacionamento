from django import forms
from .models import Perfil
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.forms import AuthenticationForm


User = get_user_model()

class RegistroUsuarioForm(UserCreationForm):
    email = forms.EmailField(required=True)

    class Meta:
        model = User
        fields = ("email", "password1", "password2")

    def clean_email(self):
        email = self.cleaned_data['email']
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError("Este e-mail já está em uso.")
        return email

class PerfilForm(forms.ModelForm):
    marca_veiculo = forms.CharField(required=False, label="Marca do Veículo")

    class Meta:
        model = Perfil
        fields = [
            'nome_completo',
            'foto',
            'telefone',
            'marca_veiculo',   # novo campo, se existir no modelo
            'modelo_veiculo',
            'cor_veiculo',
            'placa_veiculo',
        ]

class EmailAuthenticationForm(AuthenticationForm):
    username = forms.EmailField(label="Email", max_length=254)