import requests
import json
import os
import django
from django.conf import settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "estacionamentoInteligente.settings")
django.setup()

marcas_brasileiras = {
    "Chevrolet", "Honda", "Dodge", "Toyota", "BMW", "Nissan", "Volkswagen",
    "Kia", "RAM", "Mercedes", "Subaru", "Mini", "Jeep", "Hyundai", "Ford",
    "Audi", "Mitsubishi", "Fiat", "BYD", "Renault", "Citroen", "Peugeot",
    "Caoa Chery", "Volvo", "Land Rover"
}

veiculos = []
modelos_por_marca = {}
headers = {"Authorization": f"Bearer {settings.AUTO_DEV_API_KEY}"}

for page in range(1, 201):  # Ajuste o range conforme quiser
    print(f"Coletando página {page}...")
    url = f"https://auto.dev/api/listings?page={page}&rows=100"
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"Erro na página {page}")
        continue

    registros = response.json().get("records", [])
    for item in registros:
        marca = item.get("make", "").strip()
        modelo = item.get("model", "").strip()
        imagem = item.get("primaryPhotoUrl", "")
        if marca not in marcas_brasileiras or not modelo:
            continue
        if marca not in modelos_por_marca:
            modelos_por_marca[marca] = set()
        if modelo not in modelos_por_marca[marca]:
            modelos_por_marca[marca].add(modelo)
            veiculos.append({
                "marca": marca,
                "modelo": modelo,
                "imagem": imagem
            })

with open("veiculos.json", "w", encoding="utf-8") as f:
    json.dump(veiculos, f, ensure_ascii=False, indent=2)

print(f"Total de veículos salvos: {len(veiculos)}")