// ui_handlers.js
// Funções responsáveis por renderizar elementos na interface e gerenciar modais/abas

import { fetchMySpots, fetchSpots, deleteSpot, updateSpotStatus } from './api_services.js';
import { initializeAutocomplete, configurarBuscaEndereco, initMap, map, carregarSpots as carregarSpotsDoMapa } from './map_utilities.js';
import { setupEditSpotForm } from './form_handlers.js';

// Variáveis para guardar o estado do modal de reserva
let currentSpotId = null; 
let currentSpotPriceHour = 0;
let currentSelectedVaga = null; // Para guardar 'V1', 'V2', etc
let currentSpotAvailabilities = [];
let selectedAvailabilitySlot = null;
let reservationDatePicker;
let startTimeInput;
let endTimeInput;
let totalHoursSpan;
let totalPriceSpan;
let availableSlotsForDateDiv;
let dynamicTimeSlotsDiv;
let noSlotsMessageP;
let vagasGridContainerDiv;
let vagasGridDiv;
let reserveButton;

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
            
            if (content.dataset.displayFlex === 'true') { 
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
        
        await initMap(); // Garante que o mapa esteja carregado

        // Pequeno delay para garantir que o elemento do mapa esteja visível e renderizado
        setTimeout(() => {
            // Verificando se 'map' (o objeto Google Map) e as bibliotecas globais do Google existem
            if (map && window.google && window.google.maps) {
                google.maps.event.trigger(map, 'resize');
                map.setCenter(map.getCenter()); // Re-centraliza o mapa
                console.log("activateTab: Mapa redimensionado e centralizado.");
                carregarSpotsDaListaEdoMapa();
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
        // Se o fetchMySpots agora pega o token internamente, esta chamada está correta
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
        // Opcional: Mostrar uma mensagem de erro na UI
        const container = document.getElementById("myVagasContainer");
        if (container) {
            container.innerHTML = `<p class="text-center text-red-500 mt-6">Erro ao carregar suas vagas: ${error.message}.</p>`;
        }
    }
}

export async function carregarSpotsDaListaEdoMapa() {
    console.log("carregarSpotsDaListaEdoMapa: Iniciando...");
    try {
        const spots = await fetchSpots(); // Pega os spots da API
        console.log("carregarSpotsDaListaEdoMapa: Spots recebidos:", spots);

        window.allSpots = spots; // Importante para que a busca por ID funcione em main.js

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
                            // Chamando o modal de sucesso
                            alert(`Vaga ${newStatus.toLowerCase()} com sucesso!`); // Temporário
                            carregarMinhasVagas();
                        })
                        .catch(error => {
                            // Chamando o modal de erro
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
            const modalMessage = modalConfirm?.querySelector('.modal-message-placeholder');

            if (modalConfirm && confirmBtn && modalMessage) {
                modalMessage.textContent = "Tem certeza que deseja excluir esta vaga? Esta ação não pode ser desfeita."; // Atualiza a mensagem

                confirmBtn.dataset.spotId = spot.id;

                modalConfirm.classList.remove("hidden");
            } else {
                console.warn("Elemento(s) do modal de exclusão não encontrado(s). Usando confirmação padrão.");
                if (confirm("Tem certeza que deseja excluir esta vaga? Esta ação não pode ser desfeita.")) {
                    deleteSpot(spot.id)
                        .then(() => {
                            // Chamando o modal de sucesso
                            alert("Vaga excluída com sucesso!"); // Temporário
                            card.remove();
                            carregarMinhasVagas();
                        })
                        .catch(error => {
                            // Chamando o modal de erro
                            console.error("Erro ao excluir vaga:", error);
                            alert("Erro ao excluir vaga."); // Temporário
                        });
                }
            }
        });
    }
}

export function openReservationModal(spotDetails) {
    const modal = document.getElementById('parking-detail-modal');
    if (!modal) {
        console.error("Erro: Modal de detalhes da vaga não encontrado.");
        return;
    }

    modal.classList.remove('hidden'); // Torna o modal visível

    currentSpotId = spotDetails.id;
    const priceHour = parseFloat(spotDetails.price_hour); 
    const priceHourFormatted = isNaN(priceHour) ? 'N/A' : priceHour.toFixed(2).replace('.', ',');


    document.getElementById('modal-spot-price-hour').textContent = `Preço por hora: R$ ${priceHourFormatted}`;
    document.getElementById('modal-parking-title').textContent = spotDetails.title;
    document.getElementById('modal-parking-address').textContent = spotDetails.address;
    document.getElementById('modal-parking-description').textContent = spotDetails.description;
    // Formato com vírgula para moeda
    document.getElementById('hourly-price').textContent = `R$ ${priceHourFormatted}`;

    reservationDatePicker = document.getElementById("reservation-date-picker");
    startTimeInput = document.getElementById("start-time");
    endTimeInput = document.getElementById("end-time");
    totalHoursSpan = document.getElementById("total-hours");
    totalPriceSpan = document.getElementById("total-price");
    availableSlotsForDateDiv = document.getElementById("available-slots-for-date");
    dynamicTimeSlotsDiv = document.getElementById("dynamic-time-slots");
    noSlotsMessageP = document.getElementById("no-slots-message");
    vagasGridContainerDiv = document.getElementById("vagas-grid-container");
    vagasGridDiv = document.getElementById("vagas-grid");
    reserveButton = document.getElementById("confirm-reservation-btn");

    const reservationDatePicker = document.getElementById("reservation-date-picker");
    const startTimeInput = document.getElementById("start-time");
    const endTimeInput = document.getElementById("end-time");
    const totalHoursSpan = document.getElementById("total-hours");
    const totalPriceSpan = document.getElementById("total-price");
    const hourlyPriceSpan = document.getElementById("hourly-price");
    const availableSlotsContainer = document.getElementById("available-slots-for-date");
    const dynamicTimeSlots = document.getElementById("dynamic-time-slots");
    const noSlotsMessage = document.getElementById("no-slots-message");
    const vagasGridContainer = document.getElementById("vagas-grid-container");
    const vagasGrid = document.getElementById("vagas-grid");
    const confirmReservationBtn = document.getElementById("confirm-reservation-btn");

    console.log("startTimeInput:", startTimeInput);
    console.log("endTimeInput:", endTimeInput);   

    // Usar removeEventListener antes para evitar múltiplos listeners em reaberturas do modal
     if (startTimeInput) startTimeInput.removeEventListener("change", calculateTotalPrice);
    if (endTimeInput) endTimeInput.removeEventListener("change", calculateTotalPrice);
    if (reserveButton) reserveButton.removeEventListener("click", handleReserveButtonClick);
    // Adicionar listeners APENAS SE OS ELEMENTOS EXISTEM
    if (startTimeInput) startTimeInput.addEventListener("change", calculateTotalPrice);
    if (endTimeInput) endTimeInput.addEventListener("change", calculateTotalPrice);
    if (reserveButton) reserveButton.addEventListener("click", handleReserveButtonClick);

    // Inicialize o Flatpickr
    if (reservationDatePicker) {
        if (reservationDatePicker._flatpickr) {
            reservationDatePicker._flatpickr.destroy();
        }
        flatpickr(reservationDatePicker, {
            // Suas configurações flatpickr
            minDate: "today", // Garante que não se pode selecionar datas passadas
            dateFormat: "Y-m-d",
            onChange: function(selectedDates, dateStr, instance) {
                if (selectedDates.length > 0) {
                    fetchAndRenderAvailability(spotDetails.id, dateStr);
                }
            }
        });
        // define a data inicial como hoje
        reservationDatePicker.value = flatpickr.formatDate(new Date(), "Y-m-d");
        reservationDatePicker.dispatchEvent(new Event('change'));
    } else {
        console.error("Erro: reservation-date-picker não encontrado.");
    }

    calculateTotalPrice();

    fetchAndRenderAvailability(spotDetails.id, reservationDatePicker.value);
}

function renderAvailabilityForDate(selectedDateStr) {
    if (!dynamicTimeSlotsDiv || !noSlotsMessageP || !vagasGridDiv || !vagasGridContainerDiv) {
        console.error("Elementos de exibição de disponibilidade não encontrados.");
        return;
    }

    dynamicTimeSlotsDiv.innerHTML = ''; 
    vagasGridDiv.innerHTML = ''; 

    const dailyAvailabilities = currentSpotAvailabilities.filter(avail => avail.available_date === selectedDateStr);

    if (dailyAvailabilities.length === 0) {
        noSlotsMessageP.textContent = "Nenhum horário disponível para esta data.";
        noSlotsMessageP.classList.remove('hidden');
        vagasGridContainerDiv.classList.add('hidden');
        return;
    }
    noSlotsMessageP.classList.add('hidden');

    dailyAvailabilities.forEach(slot => {
        const slotDiv = document.createElement("div");
        slotDiv.className = "flex items-center p-2 border rounded-md cursor-pointer hover:bg-blue-50 focus:bg-blue-100 time-slot-item";
        slotDiv.dataset.slotId = slot.id || JSON.stringify(slot); 
        slotDiv.innerHTML = `
            <span class="font-medium">${slot.start_time.substring(0, 5)} - ${slot.end_time.substring(0, 5)}</span>
            <span class="ml-auto text-blue-600">${slot.available_quantity} vagas disponíveis</span>
        `;
        dynamicTimeSlotsDiv.appendChild(slotDiv);

        slotDiv.addEventListener('click', () => {
            dynamicTimeSlotsDiv.querySelectorAll('.time-slot-item').forEach(div => {
                div.classList.remove("bg-blue-200");
            });
            slotDiv.classList.add("bg-blue-200"); 

            selectedAvailabilitySlot = slot; 

            startTimeInput.value = slot.start_time;
            endTimeInput.value = slot.end_time;
            startTimeInput.disabled = false; 
            endTimeInput.disabled = false;   

            renderVagasGrid(slot.available_quantity); 
            vagasGridContainerDiv.classList.remove('hidden');
            calculateTotalPrice(); 
        });
    });
}


function renderVagasGrid(quantity) {
    if (!vagasGridDiv) {
        console.error("Elemento vagas-grid não encontrado.");
        return;
    }
    vagasGridDiv.innerHTML = ""; 
    currentSelectedVaga = null; 

    if (quantity <= 0) {
        vagasGridDiv.innerHTML = "<p class='text-red-500'>Nenhuma vaga disponível neste horário.</p>";
        return;
    }

    for (let i = 1; i <= quantity; i++) {
        const div = document.createElement("div");
        div.textContent = `V${i}`;
        div.className = "text-center p-2 rounded border cursor-pointer bg-green-100 hover:bg-blue-100";
        div.dataset.seat = `V${i}`;
        div.addEventListener("click", () => {
            vagasGridDiv.querySelectorAll("div").forEach(d => d.classList.remove("bg-blue-500", "text-white"));
            div.classList.add("bg-blue-500", "text-white");
            currentSelectedVaga = `V${i}`; 
        });
        vagasGridDiv.appendChild(div);
    }
}


// --- Funções de Cálculo e Requisição de Reserva
function calculateTotalPrice() {
    const startTimeInput = document.getElementById("start-time");
    const endTimeInput = document.getElementById("end-time");
    const totalHoursSpan = document.getElementById("total-hours");
    const totalPriceSpan = document.getElementById("total-price");
    const hourlyPriceSpan = document.getElementById("hourly-price");

    // Verificações antes de prosseguir com o cálculo
    if (!startTimeInput || !endTimeInput || !totalHoursSpan || !totalPriceSpan || !hourlyPriceSpan) {
        console.warn("calculateTotalPrice: Um ou mais elementos de cálculo não encontrados. O cálculo não será realizado.");
        return;
    }

    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;
    const hourlyPriceText = hourlyPriceSpan.textContent; // "R$ 8,00"
    const hourlyPrice = parseFloat(hourlyPriceText.replace('R$', '').replace(',', '.').trim());

    if (!startTime || !endTime || isNaN(hourlyPrice)) {
        totalHoursSpan.textContent = "0";
        totalPriceSpan.textContent = "R$ 0,00";
        return;
    }

    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);

    if (end < start) {
        totalHoursSpan.textContent = "0";
        totalPriceSpan.textContent = "R$ 0,00";
        alert("A hora final não pode ser antes da hora de início.");
        return;
    }

    const diffMs = end - start; // Diferença em milissegundos
    const diffHours = diffMs / (1000 * 60 * 60); // Diferença em horas

    totalHoursSpan.textContent = diffHours.toFixed(2).replace('.', ',');
    totalPriceSpan.textContent = `R$ ${(diffHours * hourlyPrice).toFixed(2).replace('.', ',')}`;
}

function handleConfirmReservation(spotDetails) {
    // Lógica para confirmar a reserva
    console.log("Reserva confirmada para:", spotDetails);
    // Exibir modal de confirmação, enviar para a API, etc.
}

async function handleReserveButtonClick() { // Tornar uma função separada
    // Validação antes de enviar
    if (!currentSpotId || !selectedAvailabilitySlot || !currentSelectedVaga || 
        !reservationDatePicker.value ||
        !startTimeInput.value ||
        !endTimeInput.value) {
        alert("Por favor, selecione uma data, horário e vaga para a reserva.");
        return;
    }

    const reservationData = {
        spot: currentSpotId,
        reservation_date: reservationDatePicker.value,
        start_time: startTimeInput.value,
        end_time: endTimeInput.value,
        selected_vaga: currentSelectedVaga, 
    };

    try {
        const response = await fetch('/api/reservations/', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken') 
            },
            body: JSON.stringify(reservationData)
        });

        if (response.ok) {
            alert("Reserva realizada com sucesso!");
            document.getElementById("parking-detail-modal").classList.add("hidden");
        } else {
            const errorData = await response.json();
            alert(`Erro ao reservar: ${JSON.stringify(errorData)}`);
        }
    } catch (error) {
        console.error("Erro na requisição de reserva:", error);
        alert("Ocorreu um erro ao tentar reservar a vaga.");
    }
}

// Helper para CSRF token
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// --- Setup dos Listeners de Modais e Botões de Ação ---
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
                    const successModal = document.getElementById("delete-success-modal"); 
                    const successMessage = successModal?.querySelector('.modal-message-placeholder');
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