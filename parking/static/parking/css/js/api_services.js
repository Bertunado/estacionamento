// Contém as funções para fazer requisições a API.

import { csrfToken, allSpots } from './globals.js';

export async function fetchSpots() {
  try {
    const response = await fetch("/parking/api/spots/");
    if (!response.ok) throw new Error("Falha ao buscar vagas");
    const data = await response.json();
    return data.results || data;
  } catch (error) {
    console.error("Erro ao buscar vagas:", error);
    throw error;
  }
}

export async function fetchMySpots() {
  try {
    const response = await fetch("/parking/api/minhas-vagas/");
    if (!response.ok) throw new Error("Falha ao buscar minhas vagas");
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Erro ao carregar minhas vagas:", error);
    throw error;
  }
}

export async function createSpot(payload) {
  const resp = await fetch("/parking/api/spots/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Erro ao salvar vaga: ${errText}`);
  }
  return resp.json();
}

export async function updateSpotStatus(spotId, status) {
  const resp = await fetch(`/parking/api/spots/${spotId}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify({ status: status }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Erro ao ${status === 'Desativada' ? 'desativar' : 'ativar'} vaga: ${errText}`);
  }
  return resp.json();
}

export async function deleteSpot(spotId) {
  const resp = await fetch(`/parking/api/spots/${spotId}/`, {
    method: "DELETE",
    headers: {
      "X-CSRFToken": csrfToken,
    },
  });
  if (!resp.ok) throw new Error("Erro ao excluir a vaga");
  return resp;
}

export async function fetchSpotDetails(spotId) {
  const resp = await fetch(`/parking/api/spots/${spotId}/`);
  if (!resp.ok) throw new Error("Erro ao carregar vaga para edição.");
  return resp.json();
}

export async function updateSpot(spotId, payload) {
  const resp = await fetch(`/parking/api/spots/${spotId}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw new Error("Erro ao salvar alterações.");
  return resp.json();
}

export async function uploadPhotos(spotId, files) {
  if (!files.length) return;

  const formData = new FormData();
  formData.append("spot", spotId);
  for (const file of files) {
    formData.append("image", file);
  }

  const resp = await fetch("/parking/api/photos/", {
    method: "POST",
    headers: {
      "X-CSRFToken": csrfToken,
    },
    body: formData,
  });
  if (!resp.ok) {
    alert("Erro ao enviar fotos.");
    throw new Error("Erro ao enviar fotos.");
  }
  return resp.json();
}

export function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.startsWith(name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

export async function saveAvailabilities(spotId, availabilities) {
  const data = {
    spot_id: spotId,
    availabilities: availabilities
  };

  const response = await fetch("/salvar-disponibilidade/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken")
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error("Erro ao salvar disponibilidades");
  }
  return response.json();
}