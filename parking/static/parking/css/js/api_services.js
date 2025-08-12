// Contém as funções para fazer requisições a API.
import { getCookie } from './utils.js'; // Ajuste o caminho conforme a estrutura de pastas

function getCsrfToken() {
    // Busca o token CSRF do cookie, que é o método padrão do Django
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith('csrftoken=')) {
                cookieValue = decodeURIComponent(cookie.substring(10)); // 'csrftoken='.length é 10
                break;
            }
        }
    }
    if (!cookieValue) {
        console.warn("CSRF token não encontrado no cookie.");
        const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
        if (csrfInput) {
            cookieValue = csrfInput.value;
            console.log("CSRF token obtido do input hidden.");
        }
    }
    return cookieValue;
}

function getAuthToken() {
    return localStorage.getItem('authToken'); 
}

export async function fetchSpots() {
  try {
    const response = await fetch("/parking/api/spots/");
    if (!response.ok) throw new Error("Falha ao buscar vagas");
    const data = await response.json();
     return data.results || data; // Assumindo que a API pode retornar 'results' ou os dados diretos
  } catch (error) {
    console.error("Erro ao buscar vagas:", error);
    throw error;
  }
}

export async function createSpot(payload) {
    const csrfToken = getCsrfToken(); // Obtendo o token aqui
    if (!csrfToken) {
        throw new Error("CSRF token ausente. Não foi possível criar a vaga.");
    }

    const resp = await fetch("/parking/api/spots/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken, // Usando a função para obter o token
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
    const csrfToken = getCsrfToken(); // Obtendo o token aqui
    if (!csrfToken) {
        throw new Error("CSRF token ausente. Não foi possível atualizar o status.");
    }
    const resp = await fetch(`/parking/api/spots/${spotId}/`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken, // Usando a função para obter o token
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
    const csrfToken = getCsrfToken(); // Obtendo o token aqui
    if (!csrfToken) {
        throw new Error("CSRF token ausente. Não foi possível excluir a vaga.");
    }
    const resp = await fetch(`/parking/api/spots/${spotId}/`, {
        method: "DELETE",
        headers: {
            "X-CSRFToken": csrfToken, // Usando a função para obter o token
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
    const csrfToken = getCsrfToken(); // Obtendo o token aqui
    if (!csrfToken) {
        throw new Error("CSRF token ausente. Não foi possível atualizar a vaga.");
    }
    const resp = await fetch(`/parking/api/spots/${spotId}/`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken, // Usando a função para obter o token
        },
        body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error("Erro ao salvar alterações.");
    return resp.json();
}

export async function uploadPhotos(spotId, files) {
    if (!files.length) return;

    const csrfToken = getCsrfToken(); // Obtendo o token aqui
    if (!csrfToken) {
        throw new Error("CSRF token ausente. Não foi possível enviar as fotos.");
    }

    const formData = new FormData();
    formData.append("spot", spotId);
    for (const file of files) {
        formData.append("image", file);
    }

    const resp = await fetch("/parking/api/photos/", {
        method: "POST",
        headers: {
            "X-CSRFToken": csrfToken, // Usando a função para obter o token
        },
        body: formData,
    });
    if (!resp.ok) {
        alert("Erro ao enviar fotos.");
        throw new Error("Erro ao enviar fotos.");
    }
    return resp.json();
}

export async function saveAvailabilities(spotId, availabilities) {
    try {
        const response = await fetch('/parking/salvar-disponibilidade/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'), // Certifique-se de ter essa função
            },
            body: JSON.stringify({
                spot_id: spotId,
                availabilities: availabilities // O array de objetos de disponibilidade
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao salvar disponibilidades.');
        }
        return await response.json();
    } catch (error) {
        console.error("Erro na API saveAvailabilities:", error);
        throw error;
    }
}

export async function fetchMySpots() {
    const token = getAuthToken(); // Pega o token aqui
    if (!token) {
        console.error("Token de autenticação não encontrado.");
        throw new Error("Usuário não autenticado. Faça login.");
    }

    try {
        const response = await fetch('/parking/api/minhas-vagas/', {
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Falha ao buscar minhas vagas: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Erro ao buscar vagas:', error);
        
        throw error;
    }
}

export async function fetchSpotReservations(spotId, date) {
    const url = `http://127.0.0.1:8000/parking/api/parking-spots/${spotId}/reservations/?date=${date}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Erro ao buscar as reservas da vaga.');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Erro na API fetchSpotReservations:", error);
        throw error;
    }
}

export async function createReservation(payload) {
    // ✅ PASSO 1: Obtenha o token de autenticação e o token CSRF
    const token = getAuthToken();
    const csrfToken = getCsrfToken(); 

    if (!token) {
        console.error("Token de autenticação não encontrado.");
        throw new Error("Usuário não autenticado. Faça login.");
    }
    if (!csrfToken) {
        console.error("CSRF token não encontrado.");
        throw new Error("CSRF token ausente. Não foi possível criar a reserva.");
    }

    try {
        const response = await fetch('http://127.0.0.1:8000/parking/api/reservations/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${token}`,
                // ✅ PASSO 2: Inclua o cabeçalho do token CSRF
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify(payload),
        });

        // Tenta ler o corpo da resposta como JSON, mesmo que seja um erro
        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data.detail || data.non_field_errors || 'Erro desconhecido ao criar a reserva.';
            throw new Error(errorMessage);
        }

        return data; // Retorna os dados da reserva se a resposta for bem-sucedida
    } catch (error) {
        console.error("Erro na API createReservation:", error);
        throw error; // Repropaga o erro para ser capturado no ui_handlers.js
    }
}

export async function fetchMyReservations() {
    console.log("Buscando minhas reservas...");
    const token = getCookie('csrftoken'); // Certifique-se de que a API usa CSRF ou tokens de autenticação
    try {
        const response = await fetch('http://127.0.0.1:8000/parking/api/my-reservations/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': token,
            },
        });
        if (!response.ok) {
            throw new Error('Erro ao buscar reservas.');
        }
        const data = await response.json();
        console.log("Reservas recebidas:", data);
        return data;
    } catch (error) {
        console.error("Erro na API fetchMyReservations:", error);
        throw error;
    }
}
