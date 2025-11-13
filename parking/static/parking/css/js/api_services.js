// Contém as funções para fazer requisições a API.
import { getCookie } from './utils.js'; 

export function getCsrfToken() {
    // Busca o token CSRF do cookie, que é o método padrão do Django
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith('csrftoken=')) {
                cookieValue = decodeURIComponent(cookie.substring(10));
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

export function getAuthToken() {
    return getCookie('csrftoken');
}

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
    if (!files || files.length === 0) return;

    const csrfToken = getCsrfToken();
    if (!csrfToken) throw new Error("CSRF token ausente.");

    // Cria um array de promessas (uma requisição por foto)
    const uploadPromises = files.map(file => {
        const formData = new FormData();
        formData.append("spot", spotId);
        formData.append("image", file); // Envia uma foto de cada vez

        return fetch("/parking/api/photos/", {
            method: "POST",
            headers: {
                "X-CSRFToken": csrfToken,
            },
            body: formData,
        }).then(async response => {
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Erro ao enviar imagem ${file.name}: ${errText}`);
            }
            return response.json();
        });
    });

    // Espera todas as fotos serem enviadas antes de continuar
    // Se você enviou 3 fotos, ele vai esperar as 3 terminarem.
    return await Promise.all(uploadPromises);
}

export async function saveAvailabilities(spotId, availabilities) {
    try {
        const response = await fetch('/parking/salvar-disponibilidade/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({
                spot_id: spotId,
                availabilities: availabilities
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
    try {
        const token = getAuthToken(); // Pega o token de autenticação
        if (!token) {
            console.error("Token de autenticação não encontrado.");
            // Lança um erro para que a função chamadora possa tratar a falta de login
            throw new Error("Usuário não autenticado. Faça login.");
        }

        const response = await fetch('/parking/api/minhas-vagas/', {
            headers: {
                // Usa 'Bearer' ou 'Token' dependendo da sua configuração do Django
                'Authorization': `Token ${token}`, 
                'Content-Type': 'application/json'
            }
        });

        // Lida com respostas que não são 200 OK
        if (response.status === 401 || response.status === 403) {
            // Se o token for inválido, o backend retornará 401 ou 403
            throw new Error("Sessão expirada ou inválida. Por favor, faça login novamente.");
        }

        if (!response.ok) {
            // Lida com outros erros, como 500 (Erro no Servidor)
            const errorText = await response.text();
            throw new Error(`Falha ao buscar minhas vagas: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {

        console.error('Erro ao buscar vagas:', error);
        
        // Relança o erro para que a função que chamou 'fetchMySpots' possa tratá-lo
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
    
    const url = 'http://127.0.0.1:8000/parking/api/reservations/';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${token}`,
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify(payload),
        });
        
        if (response.ok) {
            return await response.json();
        }

        let errorData;
        try {
            errorData = await response.json();
        } catch (jsonError) {
            const errorText = await response.text();
            console.error("Erro no corpo da resposta da API (não-JSON):", errorText);
            throw new Error(`Erro ${response.status}: ${errorText || response.statusText}`);
        }
        
        const errorMessage = errorData.detail || errorData.non_field_errors || `Erro ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);

    } catch (error) {
        console.error("Erro na API createReservation:", error);
        throw error;
    }
}

export async function fetchMyReservations() {
    console.log("Buscando minhas reservas...");
    const token = getCookie('csrftoken'); 
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

export async function loadAndRenderMyReservations() {
    const container = document.getElementById("myReservationsContainer");
    if (!container) return;

    // Limpa os cards existentes para evitar duplicatas
    container.innerHTML = ''; 

    try {
        const reservations = await fetchMyReservations();
        
        if (reservations.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500">Nenhuma reserva encontrada.</p>';
        } else {
            reservations.forEach(reservation => {
                // A função que cria o card HTML
                renderMyReservation(reservation); 
            });
        }
    } catch (error) {
        console.error("Falha ao carregar e renderizar reservas:", error);
        container.innerHTML = '<p class="text-center text-red-500">Erro ao carregar suas reservas.</p>';
    }
}

export const getReservationRequests = async () => {
    const csrfToken = getCsrfToken(); // Usando sua função existente
    if (!csrfToken) {
        throw new Error("CSRF token ausente. Não foi possível buscar solicitações.");
    }

    const response = await fetch('/parking/api/my-requests/', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken // Padrão do seu arquivo
        }
    });
    
    if (!response.ok) {
        throw new Error('Erro ao buscar solicitações de reserva.');
    }
    return await response.json();
};

export const updateReservationStatus = async (id, action) => {
    const csrfToken = getCsrfToken(); // Usando sua função existente
    if (!csrfToken) {
        throw new Error("CSRF token ausente. Não foi possível atualizar o status.");
    }

    const response = await fetch(`/parking/api/reservations/${id}/update-status/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken // Padrão do seu arquivo
        },
        body: JSON.stringify({ action: action }) // Ex: { action: 'approve' }
    });
    
    if (!response.ok) {
        // Tenta pegar o erro detalhado do backend
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { detail: 'Erro desconhecido.' };
        }
        throw new Error(errorData.detail || 'Erro ao atualizar status da reserva.');
    }
    return await response.json();
};

