// ui_handlers.js
// Funções responsáveis por renderizar elementos na interface e gerenciar modais/abas

import { fetchMySpots, fetchSpots, deleteSpot, updateSpotStatus } from './api_services.js'; // Adicione deleteSpot e updateSpotStatus
import { initializeAutocomplete, configurarBuscaEndereco, initMap, map, carregarSpots as carregarSpotsDoMapa } from './map_utilities.js';
import { setupEditSpotForm } from './form_handlers.js'; // Adicione setupEditSpotForm

export async function activateTab(tabName) {
    console.log(`activateTab: Ativando aba '${tabName}'`);

    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        if (button.dataset.tab === tabName) {
            button.classList.add('border-indigo-600', 'text-indigo-600');
            button.classList.remove('border-gray-200', 'text-gray-500', 'hover:text-indigo-500');
        } else {
            button.classList.remove('border-indigo-600', 'text-indigo-600');
            button.classList.add('border-gray-200', 'text-gray-500', 'hover:text-indigo-500');
        }
    });

    tabContents.forEach(content => {
        if (content.id === tabName) {
            content.classList.add('active');
            content.classList.remove('hidden');
            // Adicione 'flex' se este for o display padrão para abas ativas
            // e 'hidden' removeu essa classe
            if (content.dataset.displayFlex === 'true') { // Adicione data-attribute no HTML se precisar
                 content.classList.add('flex');
            }
        } else {
            content.classList.remove('active');
            content.classList.remove('flex'); // Remove flex de abas inativas
            content.classList.add('hidden');
        }
    });

    // Lógica para inicializar/interagir com o mapa APENAS quando a aba 'parkings' estiver ativa
    if (tabName === 'parkings') {
        console.log("activateTab: Aba 'parkings' ativada.");
        // initMap() será chamada uma vez pelo main.js e subsequentemente retornará rapidamente
        await initMap(); // Garante que o mapa esteja carregado

        // Pequeno delay para garantir que o elemento do mapa esteja visível e renderizado
        setTimeout(() => {
            // Verificando se 'map' (o objeto Google Map) e as bibliotecas globais do Google existem
            if (map && window.google && window.google.maps) {
                google.maps.event.trigger(map, 'resize');
                map.setCenter(map.getCenter()); // Re-centraliza o mapa
                console.log("activateTab: Mapa redimensionado e centralizado.");
                carregarSpotsDaListaEdoMapa(); // Esta função está neste arquivo (ui_handlers)
                configurarBuscaEndereco(); // Garante que o search/autocomplete funciona
            } else {
                console.warn("activateTab: Mapa ou bibliotecas Google Maps não disponíveis para redimensionar ou carregar spots.");
            }
        }, 100);
    } else if (tabName === 'my-parkings') {
        carregarMinhasVagas();
    } else if (tabName === "add-parking") {
        // initializeAutocomplete gerencia sua própria inicialização única
        // (dentro dela, ela verifica 'window.autocompleteInicializado')
        setTimeout(() => {
            initializeAutocomplete();
        }, 100);
    }
}

export async function carregarMinhasVagas() {
    try {
        const vagas = await fetchMySpots();
        const container = document.getElementById("myVagasContainer");
        if (container) {
            container.innerHTML = "";
            if (vagas && vagas.length > 0) {
                vagas.forEach(spot => renderMySpot(spot));
            } else {
                container.innerHTML = `<p class="text-center text-gray-400 mt-6">Você ainda não cadastrou nenhuma vaga.</p>`;
            }
        }
    } catch (error) {
        console.error("Erro ao carregar minhas vagas na UI:", error);
    }
}

export async function carregarSpotsDaListaEdoMapa() {
    console.log("carregarSpotsDaListaEdoMapa: Iniciando...");
    try {
        const spots = await fetchSpots(); // Pega os spots da API
        console.log("carregarSpotsDaListaEdoMapa: Spots recebidos:", spots);

        window.allSpots = spots; // <--- Importante para que a busca por ID funcione em main.js

        const list = document.querySelector("#parkings .overflow-y-auto");
        if (list) {
            list.innerHTML = ""; // Limpa a lista antes de adicionar
            if (spots && spots.length > 0) {
                spots.forEach(spot => renderSpot(spot)); // Renderiza os cards na lista
            } else {
                list.innerHTML = `<p class="text-center text-gray-400 mt-6">Nenhuma vaga disponível no momento.</p>`;
            }
        }
        await carregarSpotsDoMapa(spots); // Passa os spots para a função de mapa

    } catch (error) {
        console.error("Erro ao carregar spots na UI:", error);
    }
}

export function renderSpot(spot) {
    if (!spot || !spot.id) {
        console.warn("renderSpot: Spot inválido:", spot);
        return;
    }

    const list = document.querySelector("#parkings .overflow-y-auto");
    if (!list) {
        console.warn("renderSpot: Elemento #parkings .overflow-y-auto não encontrado.");
        return;
    }

    const card = document.createElement("div");
    card.className = "border border-gray-200 rounded-lg p-3 hover:bg-gray-50 mb-2 cursor-pointer";
    card.setAttribute("data-spot-id", spot.id);
    card.innerHTML = `
        <div class="flex justify-between items-start">
            <h4 class="font-medium text-gray-800">${spot.title}</h4>
            <div class="flex items-center space-x-1 text-yellow-500 text-sm">
                <i class="fas fa-star"></i>
                <i class="fas fa-star"></i>
                <i class="fas fa-star"></i>
                <i class="fas fa-star"></i>
                <i class="far fa-star"></i>
                <span class="text-gray-600 text-xs ml-1">(4.2)</span>
            </div>
        </div>
        <p class="text-sm text-gray-600 mt-1">${spot.address}</p>

        <div class="mt-2">
            <img
                src="${spot.photos && spot.photos.length > 0 ? spot.photos[0].image : '/static/parking/css/images/placeholder.png'}"
                alt="${spot.description || spot.title}"
                class="w-full h-32 object-cover rounded"
                onerror="this.onerror=null;this.src='/static/parking/css/images/placeholder.png';"
            />
        </div>

        <div class="flex justify-between items-center mt-3">
            <div>
                <span class="font-bold text-indigo-600">R$ ${spot.price_hour}/h</span>
                <span class="text-gray-500 text-sm ml-1">ou R$ ${spot.price_day}/dia</span>
            </div>
            <button class="btn-reservar bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700">Reservar</button>
        </div>
    `;
    list.prepend(card);

    const reservarBtn = card.querySelector(".btn-reservar");
    if (reservarBtn) {
        reservarBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            openReservationModal(spot);
        });
    }

    card.addEventListener("click", () => {
        openReservationModal(spot);
    });
}


export function renderMySpot(spot) {
    const container = document.getElementById("myVagasContainer");
    if (!container) return;

    const desativada = spot.status === "Desativada";
    const card = document.createElement("div");

    card.className = `
        border rounded-lg p-4 mb-2 transition
        ${desativada ? "bg-gray-100 text-gray-500 border-gray-300" : "bg-white text-gray-800 border-gray-200"}
    `;
    card.setAttribute("data-spot-id", spot.id);

    card.innerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <h3 class="font-semibold text-lg">${spot.title}</h3>
                <p class="text-sm">${spot.address}</p>
                <p class="text-sm mt-1">R$ ${spot.price_hour}/h ou R$ ${spot.price_day}/dia</p>
            </div>
            <div>
                <span class="${desativada
                    ? "text-gray-600 bg-gray-200"
                    : "text-green-600 bg-green-100"} text-sm px-2 py-1 rounded">
                    ${spot.status || "Ativa"}
                </span>
            </div>
        </div>

        <div class="mt-3 flex items-center justify-between">
            <div class="flex space-x-2">
                <button class="bg-indigo-600 text-white px-3 py-1 text-sm rounded hover:bg-indigo-700" data-id="${spot.id}" data-action="editar">
                    Editar
                </button>
                <button class="bg-gray-100 text-gray-800 px-3 py-1 text-sm rounded hover:bg-gray-200">
                    Ver Estatísticas
                </button>
                <button class="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700" data-id="${spot.id}" data-action="${desativada ? "ativar" : "desativar"}">
                    ${desativada ? "Ativar" : "Desativar"}
                </button>
                <button class="bg-red-100 text-red-600 px-3 py-1 text-sm rounded hover:bg-red-200" data-id="${spot.id}" data-action="excluir">
                    Excluir
                </button>
            </div>
        </div>
    `;
    container.prepend(card);

    // --- ADIÇÃO DOS LISTENERS DE EVENTO ---

    const editBtn = card.querySelector('[data-action="editar"]');
    if (editBtn) {
        editBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            console.log(`Botão Editar clicado para vaga ID: ${spot.id}`);
            setupEditSpotForm(spot);
        });
    }

    const toggleStatusBtn = card.querySelector('[data-action="desativar"], [data-action="ativar"]');
    if (toggleStatusBtn) {
        toggleStatusBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const currentAction = event.target.dataset.action;
            const newStatus = currentAction === 'desativar' ? 'Desativada' : 'Ativa';
            const modalConfirm = document.getElementById("deactivate-confirm-modal");
            const confirmBtn = document.getElementById("confirm-deactivate");
            // NOVO: Adicione o elemento de mensagem dinâmica aqui
            const modalMessage = modalConfirm?.querySelector('.modal-message-placeholder'); // Use uma classe para flexibilidade

            if (modalConfirm && confirmBtn && modalMessage) {
                modalMessage.textContent = `Tem certeza que deseja ${currentAction} esta vaga?`; // Atualiza a mensagem

                confirmBtn.dataset.spotId = spot.id;
                confirmBtn.dataset.newStatus = newStatus;
                confirmBtn.dataset.actionType = currentAction;

                modalConfirm.classList.remove("hidden");
            } else {
                console.warn("Elemento(s) do modal de desativação/ativação não encontrado(s). Usando confirmação padrão.");
                if (confirm(`Tem certeza que deseja ${currentAction} esta vaga?`)) {
                    updateSpotStatus(spot.id, newStatus)
                        .then(() => {
                            // Cuidado: aqui você deve chamar o modal de sucesso, não alert()
                            alert(`Vaga ${newStatus.toLowerCase()} com sucesso!`); // Temporário
                            carregarMinhasVagas();
                        })
                        .catch(error => {
                            // Cuidado: aqui você deve chamar o modal de erro, não alert()
                            console.error(`Erro ao ${currentAction} vaga:`, error);
                            alert(`Erro ao ${currentAction} vaga.`); // Temporário
                        });
                }
            }
        });
    }

    const deleteBtn = card.querySelector('[data-action="excluir"]');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const modalConfirm = document.getElementById("delete-confirm-modal");
            const confirmBtn = document.getElementById("confirm-delete");
            // NOVO: Adicione o elemento de mensagem dinâmica aqui
            const modalMessage = modalConfirm?.querySelector('.modal-message-placeholder'); // Use uma classe para flexibilidade

            if (modalConfirm && confirmBtn && modalMessage) {
                modalMessage.textContent = "Tem certeza que deseja excluir esta vaga? Esta ação não pode ser desfeita."; // Atualiza a mensagem

                confirmBtn.dataset.spotId = spot.id;

                modalConfirm.classList.remove("hidden");
            } else {
                console.warn("Elemento(s) do modal de exclusão não encontrado(s). Usando confirmação padrão.");
                if (confirm("Tem certeza que deseja excluir esta vaga? Esta ação não pode ser desfeita.")) {
                    deleteSpot(spot.id)
                        .then(() => {
                            // Cuidado: aqui você deve chamar o modal de sucesso, não alert()
                            alert("Vaga excluída com sucesso!"); // Temporário
                            card.remove();
                            carregarMinhasVagas();
                        })
                        .catch(error => {
                            // Cuidado: aqui você deve chamar o modal de erro, não alert()
                            console.error("Erro ao excluir vaga:", error);
                            alert("Erro ao excluir vaga."); // Temporário
                        });
                }
            }
        });
    }

    card.addEventListener("click", () => {
        openReservationModal(spot);
    });
}


export function openReservationModal(spot) {
    const modal = document.getElementById("parking-detail-modal");
    if (!modal) return;

    document.getElementById("modal-parking-title").textContent = spot.title;
    document.getElementById("modal-parking-address").textContent = spot.address;
    document.getElementById("modal-parking-description").textContent = spot.description;

    const priceHour = parseFloat(spot.price_hour);
    document.getElementById("hourly-price").textContent = `R$ ${spot.price_hour ? spot.price_hour.toFixed(2).replace('.', ',') : '0,00'}`;
    const modalImage = modal.querySelector('img');
    if (modalImage && spot.photos && spot.photos.length > 0) {
        modalImage.src = spot.photos[0].image;
        modalImage.alt = spot.title;
    } else if (modalImage) {
        modalImage.src = '/static/parking/css/images/placeholder.png';
        modalImage.alt = 'Vaga sem imagem';
    }

    document.getElementById("total-hours").textContent = "0";
    document.getElementById("total-price").textContent = "R$ 0,00";

    const vagasGrid = document.getElementById("vagas-grid");
    if (!vagasGrid) {
        console.error("Elemento 'vagas-grid' não encontrado.");
        return;
    }
    vagasGrid.innerHTML = "";

    const numVagasDisplay = spot.quantity_vagas || 1;

    for (let i = 1; i <= numVagasDisplay; i++) {
        const div = document.createElement("div");
        div.textContent = `V${i}`;
        div.className = "text-center p-2 rounded border cursor-pointer bg-green-100 hover:bg-blue-100";
        div.dataset.seat = `V${i}`;
        div.addEventListener("click", () => {
            vagasGrid.querySelectorAll("div").forEach(d => d.classList.remove("bg-blue-500", "text-white"));
            div.classList.add("bg-blue-500", "text-white");
            window.selectedVaga = `V${i}`;
        });
        vagasGrid.appendChild(div);
    }

    modal.classList.remove("hidden");
}

export function setupModalClosers() {
    document.getElementById("close-modal")?.addEventListener("click", () => {
        const modal = document.getElementById("parking-detail-modal");
        if (modal) modal.classList.add("hidden");
    });

    document.getElementById("cancel-edit")?.addEventListener("click", () => {
        document.getElementById("edit-spot-modal").classList.add("hidden");
    });

    document.getElementById("success-ok")?.addEventListener("click", () => {
        document.getElementById("delete-success-modal").classList.add("hidden");
    });

    document.getElementById("cancel-deactivate")?.addEventListener("click", () => {
        document.getElementById("deactivate-confirm-modal").classList.add("hidden");
    });

    document.getElementById("cancel-delete")?.addEventListener("click", () => {
        document.getElementById("delete-confirm-modal").classList.add("hidden");
    });

    document.getElementById("close-confirmation-btn")?.addEventListener("click", () => {
        document.getElementById("reservation-confirmation-modal").classList.add("hidden");
    });

    document.getElementById("error-ok")?.addEventListener("click", () => {
    document.getElementById("error-modal").classList.add("hidden");
});


 const confirmDeactivateBtn = document.getElementById("confirm-deactivate");
    if (confirmDeactivateBtn) {
        confirmDeactivateBtn.addEventListener("click", async () => {
            const spotId = confirmDeactivateBtn.dataset.spotId;
            const newStatus = confirmDeactivateBtn.dataset.newStatus;
            const actionType = confirmDeactivateBtn.dataset.actionType;

            // Esconde o modal de confirmação imediatamente
            document.getElementById("deactivate-confirm-modal")?.classList.add("hidden");

            if (spotId && newStatus) {
                try {
                    await updateSpotStatus(spotId, newStatus);
                    // Mostra o modal de sucesso
                    const successModal = document.getElementById("delete-success-modal"); // Você pode renomear este para algo mais genérico ou criar um novo
                    const successMessage = successModal?.querySelector('.modal-message-placeholder'); // Adicione um placeholder para mensagem dinâmica
                    if (successModal && successMessage) {
                        successMessage.textContent = `Vaga ${actionType === 'desativar' ? 'desativada' : 'ativada'} com sucesso!`;
                        successModal.classList.remove("hidden");
                    } else {
                        alert(`Vaga ${actionType === 'desativar' ? 'desativada' : 'ativada'} com sucesso!`);
                    }
                    carregarMinhasVagas();
                } catch (error) {
                    console.error(`Erro ao ${actionType} vaga:`, error);
                    // Mostra um modal de erro (precisa ser criado no HTML)
                    const errorModal = document.getElementById("error-modal"); // Crie este modal
                    const errorMessageDisplay = errorModal?.querySelector('.modal-message-placeholder');
                    if (errorModal && errorMessageDisplay) {
                        errorMessageDisplay.textContent = `Erro ao ${actionType} vaga: ${error.message || error}`;
                        errorModal.classList.remove("hidden");
                    } else {
                        alert(`Erro ao ${actionType} vaga.`);
                    }
                }
            }
        });
    }

    // Listener para o botão de confirmação do modal de Excluir
    const confirmDeleteBtn = document.getElementById("confirm-delete");
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener("click", async () => {
            const spotId = confirmDeleteBtn.dataset.spotId;

            // Esconde o modal de confirmação imediatamente
            document.getElementById("delete-confirm-modal")?.classList.add("hidden");

            if (spotId) {
                try {
                    await deleteSpot(spotId);
                    // Mostra o modal de sucesso
                    const successModal = document.getElementById("delete-success-modal");
                    const successMessage = successModal?.querySelector('.modal-message-placeholder');
                    if (successModal && successMessage) {
                        successMessage.textContent = "Vaga excluída com sucesso!"; // Mensagem específica para exclusão
                        successModal.classList.remove("hidden");
                    } else {
                        alert("Vaga excluída com sucesso!");
                    }
                    carregarMinhasVagas();
                    // Opcional: remover o card específico do DOM
                } catch (error) {
                    console.error("Erro ao excluir vaga:", error);
                    // Mostra um modal de erro
                    const errorModal = document.getElementById("error-modal");
                    const errorMessageDisplay = errorModal?.querySelector('.modal-message-placeholder');
                    if (errorModal && errorMessageDisplay) {
                        errorMessageDisplay.textContent = `Erro ao excluir vaga: ${error.message || error}`;
                        errorModal.classList.remove("hidden");
                    } else {
                        alert("Erro ao excluir vaga.");
                    }
                }
            }
        });
    }
}
