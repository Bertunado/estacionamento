// ui_handlers.js
// Funções responsáveis por renderizar elementos na interface e gerenciar modais/abas

import { fetchMySpots, fetchSpots, deleteSpot, updateSpotStatus, createReservation, fetchMyReservations, fetchSpotReservations } from './api_services.js';
import { initializeAutocomplete, configurarBuscaEndereco, initMap, map, carregarSpots as carregarSpotsDoMapa } from './map_utilities.js';
import { setupEditSpotForm } from './form_handlers.js';
import { getCookie } from './utils.js'; // Ajuste o caminho conforme a estrutura de pastas
import { setupAvailabilityFields } from './availability_manager.js';


// Variáveis para guardar o estado do modal de reserva
let currentSpotId = null;
let currentSpotPriceHour = 0;
let currentSpotAvailabilities = [];
let availableSlotsForDateDiv;
let dynamicVagaSquaresDiv;
let noSlotsMessageP;
let reserveButton;
let reservationModal; 
let reservationCalendarInstance = null;
let currentSpotDetails = null;
let currentSelectedReservationOption = null;
let modalParkingTitle;
let modalParkingAddress;
let modalSellerProfileImage;
let modalSellerName;
let modalParkingDescription;
let modalParkingType;
let modalParkingQuantity;
let modalSpotPriceHourElement; // Renomeado para evitar conflito de nome com a variável global `currentSpotPriceHour`
let modalSpotLocationElement; // Esta é a que estava faltando!
let modalParkingImage;
let currentSelectedSlot = {
    date: null,
    slotNumber: null
};

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

        setTimeout(() => {
            if (map && window.google && window.google.maps) {
                google.maps.event.trigger(map, 'resize');
                map.setCenter(map.getCenter());
                console.log("activateTab: Mapa redimensionado e centralizado.");
                carregarSpotsDaListaEdoMapa();
                configurarBuscaEndereco();
            } else {
                console.warn("activateTab: Mapa ou bibliotecas Google Maps não disponíveis para redimensionar ou carregar spots.");
            }
        }, 100);
    } else if (tabName === 'my-parkings') {
        carregarMinhasVagas();
    } else if (tabName === 'my-reservations') { // Adicione esta condição
        carregarMinhasReservas(); 
    } else if (tabName === "add-parking") {
        console.log("activateTab: Aba 'add-parking' ativada.");
        setTimeout(() => {
            initializeAutocomplete();
            setupAvailabilityFields(); 
            console.log("setupAvailabilityFields() chamado ao ativar a aba 'add-parking'.");
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

function formatarTipoVaga(tipo) {
    switch (tipo) {
        case 'rua_coberta': return 'Rua (Coberta)';
        case 'rua_descoberta': return 'Rua (Descoberta)';
        case 'garagem': return 'Garagem';
        case 'predio_coberta': return 'Prédio (Coberta)';
        case 'predio_descoberta': return 'Prédio (Descoberta)';
        default: return tipo; // Retorna o valor original se não for reconhecido
    }
}

function formatarTamanhoVaga(tamanho) {
    if (typeof tamanho === 'string') {
        return tamanho.replace(/\s*\(.*\)/, '').trim();
    }
    return tamanho; 
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
    const formattedTipoVaga = formatarTipoVaga(spot.tipo_vaga); 
    const formattedTamanhoVaga = formatarTamanhoVaga(spot.size);

    card.innerHTML = `
        <div class="flex justify-between items-start">
            <h4 class="font-medium text-gray-800">${spot.title} <span class="text-gray-400 text-sm ml-1">- ${formattedTamanhoVaga}</span></h4>
            <div class="flex items-center space-x-1 text-yellow-500 text-sm">
                <i class="fas fa-star"></i>
                <i class="fas fa-star"></i>
                <i class="fas fa-star"></i>
                <i class="fas fa-star"></i>
                <i class="far fa-star"></i>
                <span class="text-gray-600 text-xs ml-1">(4.2)</span>
            </div>
        </div>
        
        <div class="flex justify-between items-center mt-1">
            <p class="text-sm text-gray-600">Localização: ${spot.address}</p>
            <p class="text-sm text-gray-500">${formattedTipoVaga}</p>
        </div>

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
                <span class="font-bold text-indigo-600">R$ ${parseFloat(spot.price_hour).toFixed(2).replace('.', ',')}/h</span>
                <span class="text-gray-500 text-sm ml-1">ou R$ ${parseFloat(spot.price_day).toFixed(2).replace('.', ',')}/dia</span>
            </div>
            <button class="btn-reservar bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700">Reservar</button>
        </div>
    `;
    list.prepend(card);

    const reservarBtn = card.querySelector(".btn-reservar");
    if (reservarBtn) {
        reservarBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            console.log("Clique no botão 'Reservar'. Abrindo modal de detalhes.");
            openParkingDetailModal(spot);
        });
    }


    const editBtn = card.querySelector('[data-action="editar"]');
    if (editBtn) {
        editBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // Impede o clique de abrir o modal de detalhes
            console.log(`Botão de editar para a vaga ${spot.id} clicado.`);
            openEditSpotModal(spot); // Chama a função para abrir o modal de edição
        });
    }
    // --- FIM DO NOVO CÓDIGO ---

    card.addEventListener("click", () => {
        openParkingDetailModal(spot);
    });
}

// Página de Minhas Vagas
export function renderMySpot(spot) {
    const container = document.getElementById("myVagasContainer");
    if (!container) return;

    const desativada = spot.status === "Desativada";
    const card = document.createElement("div");
    card.className = "border border-gray-200 rounded-lg p-3 hover:bg-gray-50 mb-2";


    card.innerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <h3 class="font-semibold text-lg">${spot.title}</h3>
                <p class="text-sm">${spot.address}</p>
                <p class="text-sm mt-1">R$ ${parseFloat(spot.price_hour).toFixed(2).replace('.', ',')}/h ou R$ ${parseFloat(spot.price_day).toFixed(2).replace('.', ',')}/dia</p>
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
                <button id="toggleStatusBtn-${spot.id}" class="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700" data-id="${spot.id}" data-action="${desativada ? "ativar" : "desativar"}">
                    ${desativada ? "Ativar" : "Desativar"}
                </button>
                <button id="deleteBtn-${spot.id}" class="bg-red-100 text-red-600 px-3 py-1 text-sm rounded hover:bg-red-200" data-id="${spot.id}" data-action="excluir">
                    Excluir
                </button>
            </div>
        </div>
    `;

    container.prepend(card);

     const editBtn = card.querySelector('[data-action="editar"]');
    if (editBtn) {
        editBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            console.log(`Botão de editar para a vaga ${spot.id} clicado.`);
            
            openEditSpotModal(spot);
        });
    }

    const toggleStatusBtn = card.querySelector(`#toggleStatusBtn-${spot.id}`);
    if (toggleStatusBtn) {
        toggleStatusBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const currentAction = event.target.dataset.action;
            const newStatus = currentAction === 'desativar' ? 'Desativada' : 'Ativa';
            const modalConfirm = document.getElementById("deactivate-confirm-modal");
            const confirmBtn = document.getElementById("confirm-deactivate");
            const modalMessage = modalConfirm?.querySelector('.modal-message-placeholder');

            if (modalConfirm && confirmBtn && modalMessage) {
                modalMessage.textContent = `Tem certeza que deseja ${currentAction} esta vaga?`;
                // Apenas define o ID da vaga no botão de confirmação
                confirmBtn.dataset.spotId = spot.id;
                confirmBtn.dataset.newStatus = newStatus;
                modalConfirm.classList.remove("hidden");
            }
        });
    }

    const deleteBtn = card.querySelector(`#deleteBtn-${spot.id}`);
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const modalConfirm = document.getElementById("delete-confirm-modal");
            const confirmBtn = document.getElementById("confirm-delete");
            const modalMessage = modalConfirm?.querySelector('.modal-message-placeholder');

            if (modalConfirm && confirmBtn && modalMessage) {
                modalMessage.textContent = "Tem certeza que deseja excluir esta vaga? Esta ação não pode ser desfeita.";
                // Apenas define o ID da vaga no botão de confirmação
                confirmBtn.dataset.spotId = spot.id;
                modalConfirm.classList.remove("hidden");
            }
        });
    }
}

function openEditSpotModal(spotDetails) {
    const editModal = document.getElementById('edit-spot-modal');
    if (!editModal) {
        console.error("Modal de edição não encontrado!");
        return;
    }
    
    // Preencha o formulário com os dados da vaga
    document.getElementById('edit-spot-id').value = spotDetails.id;
    document.getElementById('edit-title').value = spotDetails.title;
    document.getElementById('edit-address').value = spotDetails.address;
    document.getElementById('edit-description').value = spotDetails.description;
    document.getElementById('edit-price_hour').value = spotDetails.price_hour;
    document.getElementById('edit-price_day').value = spotDetails.price_day;
    document.getElementById('edit-size').value = spotDetails.size;
    document.getElementById('edit-tipo_vaga').value = spotDetails.tipo_vaga;

    // Mostra o modal
    editModal.classList.remove('hidden');
}

// Renderizar os horários já reservados
function renderReservedSlots(reservations) {
    const reservedSlotsContainer = document.getElementById('reserved-slots-list');
    const noReservedSlotsMessage = document.getElementById('no-reserved-slots-message');

    reservedSlotsContainer.innerHTML = '';
    
    if (reservations && reservations.length > 0) {
        noReservedSlotsMessage.classList.add('hidden');
        reservations.forEach(res => {
            const startTime = new Date(res.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const endTime = new Date(res.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const slot = document.createElement('p');
            slot.textContent = `Horário: ${startTime} - ${endTime}`;
            reservedSlotsContainer.appendChild(slot);
        });
    } else {
        noReservedSlotsMessage.classList.remove('hidden');
    }
    
    document.getElementById('reserved-slots-for-date').classList.remove('hidden');
}

// Carregar as reservas quando a data for selecionada
export async function handleDateSelection(spotId, date) {
    // Esconda a mensagem de slots não disponíveis
    document.getElementById('no-slots-message').classList.add('hidden');
    
    // Limpa os quadrados de vagas disponíveis
    document.getElementById('dynamic-vaga-squares').innerHTML = '';

    try {
        // Carrega as vagas disponíveis (sua lógica atual)
        const availableSlots = await fetchAvailableSlots(spotId, date);
        if (availableSlots && availableSlots.length > 0) {
            // Lógica para renderizar os slots disponíveis...
        } else {
            // Lógica para exibir a mensagem de que não há vagas...
        }
        
        const reservations = await fetchSpotReservations(spotId, date);
        renderReservedSlots(reservations);

    } catch (error) {
        console.error("Erro ao carregar os slots:", error);
        alert("Ocorreu um erro ao carregar os horários disponíveis.");
    }
}

// --- NOVO CÓDIGO AQUI: OUVINTE DE EVENTO GLOBAL PARA O BOTÃO "CANCELAR" E "SALVAR" ---
document.addEventListener('DOMContentLoaded', () => {
    const confirmReservationBtn = document.getElementById('confirm-reservation-btn');
     if (confirmReservationBtn) {
        confirmReservationBtn.addEventListener('click', async () => {
            console.log('Botão de confirmar reserva clicado!');

            const spotId = document.getElementById('reservation-spot-id').value;
            const startTime = document.getElementById('start-time-input').value;
            const endTime = document.getElementById('end-time-input').value;
            const selectedDateStr = currentSelectedSlot.date; 

            // Adicione estas linhas para ver o que está sendo capturado
            console.log("Valores para a reserva:");
            console.log("spotId:", spotId);
            console.log("selectedDateStr:", selectedDateStr);
            console.log("startTime:", startTime);
            console.log("endTime:", endTime);
            console.log("-------------------");

            if (!spotId || !startTime || !endTime || !selectedDateStr) {
                alert("Por favor, preencha todos os campos da reserva.");
                return;
            }
            const startDateTime = new Date(`${selectedDateStr}T${startTime}:00`);
            const endDateTime = new Date(`${selectedDateStr}T${endTime}:00`);

            if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
                alert("Horário ou data de reserva inválidos. Por favor, verifique o formato.");
                return;
            }

            if (endDateTime <= startDateTime) {
                alert("O horário de término deve ser posterior ao horário de início.");
                return;
            }

            const payload = {
            // ✅ Garanta que o payload tenha as chaves corretas
            spot: parseInt(spotId),
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
        };
             console.log("Payload enviado para a API:", payload);

            try {
                const newReservation = await createReservation(payload);
                showReservationConfirmation(newReservation);
            } catch (error) {
                console.error("Erro ao criar a reserva:", error);
                alert("Não foi possível realizar a reserva: " + error.message);
            }
        });
    }
    
    const editModal = document.getElementById('edit-spot-modal');
    if (editModal) {
        // Evento para o botão de cancelar
        const cancelBtn = editModal.querySelector('#cancel-edit');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                editModal.classList.add('hidden');
            });
        }
        
        // Evento para o formulário de edição (submissão)
        const editForm = document.getElementById('editParkingForm');
        if (editForm) {
            editForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                
                // Reúne os dados do formulário
                const updatedData = {
                    title: editForm.querySelector('#edit-title').value,
                    address: editForm.querySelector('#edit-address').value,
                    description: editForm.querySelector('#edit-description').value,
                    price_hour: parseFloat(editForm.querySelector('#edit-price_hour').value),
                    price_day: parseFloat(editForm.querySelector('#edit-price_day').value),
                    size: editForm.querySelector('#edit-size').value,
                    tipo_vaga: editForm.querySelector('#edit-tipo_vaga').value,
                };

                const spotId = editForm.querySelector('#edit-spot-id').value;
                
                try {
                    // Faça a requisição PATCH para a API
                    const response = await fetch(`/api/my-parking-spots/${spotId}/`, {
    method: 'PATCH',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
    },
    body: JSON.stringify(updatedData),
});
                    
                    if (response.ok) {
                        console.log("Vaga atualizada com sucesso!");
                        editModal.classList.add('hidden');
                        carregarMinhasVagas();
                    } else {
                        const errorData = await response.json();
                        console.error("Erro ao atualizar vaga:", errorData);
                        alert("Erro ao salvar as alterações. Verifique os dados.");
                    }

                } catch (error) {
                    console.error("Erro de rede:", error);
                    alert("Erro de conexão ao tentar salvar.");
                }
            });
        }
    }

    
});

const confirmDeleteBtn = document.getElementById("confirm-delete");
if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async (event) => {
        const spotId = event.target.dataset.spotId;
        if (spotId) {
            await deleteSpot(spotId);
            document.getElementById("delete-confirm-modal").classList.add("hidden");
            carregarMinhasVagas();
        } else {
            console.error("ID da vaga não encontrado no botão de confirmação de exclusão.");
        }
    });
}

// Adiciona listener para o botão de confirmação de desativação
const confirmDeactivateBtn = document.getElementById("confirm-deactivate");
if (confirmDeactivateBtn) {
    confirmDeactivateBtn.addEventListener("click", async (event) => {
        const spotId = event.target.dataset.spotId;
        const newStatus = event.target.dataset.newStatus;
        if (spotId && newStatus) {
            await updateSpotStatus(spotId, newStatus);
            document.getElementById("deactivate-confirm-modal").classList.add("hidden");
            carregarMinhasVagas();
        } else {
            console.error("ID da vaga ou novo status não encontrado no botão de confirmação de desativação.");
        }
    });
}

// Calculadora que atualiza os valores da reserva no card do modal
function updateReservationSummary(spotDetails, selectedSlotDate, startTime, endTime) {
    // Referências para a calculadora "Por Hora"
    const hourlyPriceElement = document.getElementById('hourly-price');
    const totalHoursElement = document.getElementById('total-hours');
    const totalPriceElement = document.getElementById('total-price');

    // Referências para a calculadora "Por Dia"
    const dailyPriceElement = document.getElementById('daily-price');
    const dailyTimesElement = document.getElementById('daily-times');
    const dailyTotalPriceElement = document.getElementById('daily-total-price');

    // Verifica se os elementos HTML da calculadora por hora existem
    if (!hourlyPriceElement || !totalHoursElement || !totalPriceElement) {
        console.error("Erro: Elementos da calculadora 'Por hora' não encontrados no modal.");
        return;
    }
    // Verifica se os elementos HTML da calculadora por dia existem
    if (!dailyPriceElement || !dailyTimesElement || !dailyTotalPriceElement) {
        console.error("Erro: Elementos da calculadora 'Por dia' não encontrados no modal.");
        return;
    }

    if (!selectedSlotDate) {
        const selectedDateObj = reservationCalendarInstance?.selectedDates[0];
        if (selectedDateObj) {
            selectedSlotDate = formatDateToISO(selectedDateObj);
        }
    }

    if (!startTime) {
        startTime = document.getElementById('start-time-input')?.value;
    }

    if (!endTime) {
        endTime = document.getElementById('end-time-input')?.value;
    }

    const priceHour = parseFloat(spotDetails.price_hour);
    const priceDay = parseFloat(spotDetails.price_day);

    // --- LÓGICA DA CALCULADORA "POR HORA" ---
    hourlyPriceElement.textContent = `R$ ${priceHour.toFixed(2).replace('.', ',')}`;

    if (!selectedSlotDate || !startTime || !endTime) {
        totalHoursElement.textContent = '0';
        totalPriceElement.textContent = 'R$ 0,00';
    } else {
        const startDateTime = new Date(`${selectedSlotDate}T${startTime}`);
        let endDateTime = new Date(`${selectedSlotDate}T${endTime}`);

        // Adição para tratar virada de dia (ex: 22:00 até 02:00)
        if (endDateTime <= startDateTime) {
            endDateTime.setDate(endDateTime.getDate() + 1); // Adiciona um dia
        }

        const durationMs = endDateTime - startDateTime;
        const durationMinutes = durationMs / (1000 * 60);
        const pricePerMinute = priceHour / 60;
        const totalPrice = durationMinutes * pricePerMinute;

        const hours = Math.floor(durationMinutes / 60);
        const minutes = Math.round(durationMinutes % 60);

        let totalDurationText = '';
        if (hours > 0) {
            totalDurationText += `${hours}h`;
        }
        if (minutes > 0 || (hours === 0 && minutes === 0 && durationMinutes === 0)) { // Garante que 0m seja exibido se for o caso
            if (totalDurationText !== '') totalDurationText += ' ';
            totalDurationText += `${minutes}m`;
        }
        
        totalHoursElement.textContent = totalDurationText || '0';
        totalPriceElement.textContent = `R$ ${totalPrice.toFixed(2).replace('.', ',')}`;
    }

    // --- LÓGICA DA CALCULADORA "POR DIA" ---
    if (!isNaN(priceDay) && priceDay > 0) {
        dailyPriceElement.textContent = `R$ ${priceDay.toFixed(2).replace('.', ',')}`;
        dailyTotalPriceElement.textContent = `R$ ${priceDay.toFixed(2).replace('.', ',')}`;
    } else {
        dailyPriceElement.textContent = `N/A`;
        dailyTotalPriceElement.textContent = `R$ 0,00`;
    }

    let dailyDisplayStartTime = 'Não informado';
    let dailyDisplayEndTime = '';

    if (selectedSlotDate && spotDetails && spotDetails.availabilities_by_date) {
        const selectedDayAvailability = spotDetails.availabilities_by_date.find(
            av => av.available_date === selectedSlotDate
        );

        if (selectedDayAvailability && selectedDayAvailability.start_time && selectedDayAvailability.end_time) {
            dailyDisplayStartTime = selectedDayAvailability.start_time.substring(0, 5);
            dailyDisplayEndTime = selectedDayAvailability.end_time.substring(0, 5);
            dailyTimesElement.textContent = `${dailyDisplayStartTime} até ${dailyDisplayEndTime}`;
        } else {
            dailyTimesElement.textContent = `Não informado para este dia`;
        }
    } else {
        dailyTimesElement.textContent = `Selecione uma data`;
    }
}

function formatarHorarioDisponivelModal(spot) {
    if (spot.availabilities_by_date && spot.availabilities_by_date.length > 0) {
        const firstAvailability = spot.availabilities_by_date[0];
        const startTime = firstAvailability.start_time ? firstAvailability.start_time.substring(0, 5) : 'N/A';
        const endTime = firstAvailability.end_time ? firstAvailability.end_time.substring(0, 5) : 'N/A';
        return `${startTime} - ${endTime}`;
    }
    // Fallback se não houver disponibilidade específica para exibir
    return '24h/dia (aprox.)'; // Ou 'Horário a combinar', etc.
}

// Atualiza os cards de vagas no mapa e na lista
export function openParkingDetailModal(spotDetails) {
    const modal = document.getElementById('parking-detail-modal');
    if (!modal) {
        console.error("Erro: Modal de detalhes da vaga (parking-detail-modal) não encontrado.");
        return;
    }

    // Preenche os dados da modal
    document.getElementById("modal-parking-title").textContent = spotDetails.title;
    document.getElementById("modal-parking-address").textContent = spotDetails.address;
    document.getElementById("modal-parking-description").textContent = spotDetails.description;
    document.getElementById('reservation-spot-id').value = spotDetails.id;
    document.getElementById('parking-detail-modal').classList.remove('hidden');

    // Atualiza a imagem da vaga
    const modalImage = document.getElementById("modal-parking-image");
    if (modalImage) {
        modalImage.src = spotDetails.photos && spotDetails.photos.length > 0 ? spotDetails.photos[0].image : '/static/parking/css/images/placeholder.png';
        modalImage.alt = spotDetails.description || spotDetails.title;
    }

    // Formata o preço por hora
    const priceHour = parseFloat(spotDetails.price_hour);
    const priceHourFormatted = isNaN(priceHour) ? 'N/A' : `R$ ${priceHour.toFixed(2).replace('.', ',')}/h`;

    // Preenche os novos campos detalhados
    document.getElementById("modal-parking-type-display").textContent = `Tipo: ${formatarTipoVaga(spotDetails.tipo_vaga)}`;
    document.getElementById("modal-parking-size-display").textContent = `Tamanho: ${formatarTamanhoVaga(spotDetails.size)}`;
    document.getElementById("modal-parking-hours-display").textContent = `Disponível: ${formatarHorarioDisponivelModal(spotDetails)}`;
    document.getElementById("modal-parking-price-display").textContent = `Preço por hora: ${priceHourFormatted}`;

    const characteristicsContainer = document.getElementById('modal-characteristics-container');
    if (characteristicsContainer) {
        characteristicsContainer.innerHTML = ''; // Limpa o conteúdo anterior

        if (spotDetails.has_camera) {
            characteristicsContainer.innerHTML += `
                <div class="flex items-center mb-1">
                    <i class="fa-solid fa-camera fa-fw text-gray-600 mr-2"></i>
                    <span>Vaga com câmera</span>
                </div>
            `;
        }
        if (spotDetails.has_supervision) {
            characteristicsContainer.innerHTML += `
                <div class="flex items-center mb-1">
                    <i class="fa-solid fa-user-shield fa-fw text-gray-600 mr-2"></i>
                    <span>Supervisão (vigilante)</span>
                </div>
            `;
        }
        if (spotDetails.has_alarm) {
            characteristicsContainer.innerHTML += `
                <div class="flex items-center mb-1">
                    <i class="fa-solid fa-bell fa-fw text-gray-600 mr-2"></i>
                    <span>Alarme no local</span>
                </div>
            `;
        }
        if (spotDetails.has_ev_charger) {
            characteristicsContainer.innerHTML += `
                <div class="flex items-center mb-1">
                    <i class="fa-solid fa-charging-station fa-fw text-gray-600 mr-2"></i>
                    <span>Tomada para carro elétrico</span>
                </div>
            `;
        }
        if (spotDetails.has_remote_monitoring) {
            characteristicsContainer.innerHTML += `
                <div class="flex items-center mb-1">
                    <i class="fa-solid fa-desktop fa-fw text-gray-600 mr-2"></i>
                    <span>Monitoramento remoto</span>
                </div>
            `;
        }
        if (spotDetails.has_car_wash) {
        characteristicsContainer.innerHTML += `
            <div class="flex items-center mb-1">
                <i class="fa-solid fa-car-wash fa-fw text-gray-600 mr-2"></i>
                <span>Lavagem de carro no local</span>
            </div>
        `;
    }
    if (spotDetails.has_valet) {
        characteristicsContainer.innerHTML += `
            <div class="flex items-center mb-1">
                <i class="fa-solid fa-user-tie fa-fw text-gray-600 mr-2"></i>
                <span>Serviço de manobrista</span>
            </div>
        `;
    }
    }
         // Esconde a seção de detalhes da vaga escolhida e reinicia as opções de reserva
        document.getElementById("selected-slot-details-section").classList.add("hidden");



    // Esconde a seção de detalhes da vaga escolhida e reinicia as opções de reserva
    document.getElementById("selected-slot-details-section").classList.add("hidden");
    const reservationOptions = modal.querySelectorAll('.reservation-option');
    reservationOptions.forEach(option => {
        option.classList.remove('selected');
        const indicator = option.querySelector('.selection-indicator');
        if (indicator) {
            indicator.classList.remove('scale-100', 'opacity-100');
            indicator.classList.add('scale-0', 'opacity-0');
        }
    });


    modal.classList.remove('hidden');

    const closeModalBtn = document.getElementById("close-modal");
    if (closeModalBtn) {
        closeModalBtn.onclick = () => {
            modal.classList.add("hidden");
        };
    }

    console.log("Spot Details completo recebido na função:", spotDetails);

    currentSpotDetails = spotDetails;
    currentSpotId = spotDetails.id;
    
    const availabilityCalendar = modal.querySelector('#reservation-calendar'); 

    const selectedDatesDisplay = modal.querySelector('#selected-reservation-dates-display');
    const availableSlotsForDateContainer = modal.querySelector('#available-slots-for-date');
    const dynamicVagaSquares = modal.querySelector('#dynamic-vaga-squares');
    const noSlotsMessage = modal.querySelector('#no-slots-message');

    const selectedSlotDetailsSection = modal.querySelector('#selected-slot-details-section');
    const selectedSlotNumberDisplay = modal.querySelector('#selected-slot-number');
    const selectedSlotDateDisplay = modal.querySelector('#selected-slot-date-display');
    const startTimeInput = modal.querySelector('#start-time-input');
    const endTimeInput = modal.querySelector('#end-time-input');
    const modalSellerProfileImage = document.getElementById('modal-seller-profile-image');
    const modalSellerName = document.getElementById('modal-seller-name');
    const profileImage = document.getElementById('modal-seller-profile-image');
    const popover = document.getElementById('seller-info-popover');


    if (availableSlotsForDateContainer) availableSlotsForDateContainer.classList.add('hidden');
    if (selectedSlotDetailsSection) selectedSlotDetailsSection.classList.add('hidden');
    if (selectedDatesDisplay) selectedDatesDisplay.textContent = "Selecione uma data para ver as vagas disponíveis.";
    if (noSlotsMessage) {
        noSlotsMessage.classList.remove('hidden');
        noSlotsMessage.textContent = "Selecione uma data para ver as vagas disponíveis.";
    }

    if (modalSellerProfileImage && modalSellerName) {
    // Verifique se os dados do proprietário existem
    if (spotDetails.owner && spotDetails.owner.perfil) {
        // Acessa o nome completo do perfil
        modalSellerName.textContent = spotDetails.owner.perfil.nome_completo || 'Vendedor não disponível';

        // Acessa a URL da foto do perfil e a atribui ao src da imagem.
        // Se a URL não existir (for null, undefined, etc.), ela irá manter o src do HTML.
        const sellerPhotoUrl = spotDetails.owner.perfil.foto;
        if (sellerPhotoUrl) {
            modalSellerProfileImage.src = sellerPhotoUrl;
        }

    } else {
        // Caso os dados não estejam disponíveis
        modalSellerName.textContent = 'Vendedor não disponível';
        // A imagem já está configurada como a padrão no HTML, não precisa ser alterada aqui.
    }
}
profileImage.addEventListener('click', (e) => {
    e.stopPropagation(); // Evita conflito com clique fora
    popover.classList.toggle('hidden');

    // Atualizar o nome no popover dinamicamente
    const sellerName = document.getElementById('modal-seller-name');
    const popoverName = document.getElementById('popover-seller-name');
    if (sellerName && popoverName) {
        popoverName.textContent = sellerName.textContent;
    }

    // Posicionamento relativo à imagem
    const rect = profileImage.getBoundingClientRect();
    popover.style.top = `${rect.bottom + window.scrollY + 5}px`;
    popover.style.left = `${rect.left + window.scrollX}px`;
});

// Fecha o popover ao clicar fora dele
document.addEventListener('click', (e) => {
    if (!popover.contains(e.target) && !profileImage.contains(e.target)) {
        popover.classList.add('hidden');
    }
});


    // Destrua instâncias anteriores para evitar duplicação (se o modal for reaberto)
    if (startTimeInput && startTimeInput._flatpickr) {
        startTimeInput._flatpickr.destroy();
    }
    if (endTimeInput && endTimeInput._flatpickr) {
        endTimeInput._flatpickr.destroy();
    }

    if (startTimeInput) {
        flatpickr(startTimeInput, {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i", // Formato 24 horas (HH:MM)
            time_24hr: true,    // Força o formato 24 horas
            minuteIncrement: 15, // Incrementos de 15 minutos (opcional)
            onReady: function(selectedDates, dateStr, instance) {
                // Define um valor padrão ao carregar, se o campo estiver vazio
                if (!instance.input.value) {
                    instance.setDate("08:00", false); // Default 08:00 se vazio
                }
            },
            // Chama updateReservationSummary ao mudar o horário de entrada ---
            onChange: function() {
                updateReservationSummary(
                    currentSpotDetails,
                    currentSelectedSlot.date, // Passa a data atualmente selecionada do calendário
                    startTimeInput.value,
                    endTimeInput ? endTimeInput.value : null
                );
            }
        });
    }

    if (endTimeInput) {
        flatpickr(endTimeInput, {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: true,
            minuteIncrement: 15,
            onReady: function(selectedDates, dateStr, instance) {
                // Define um valor padrão ao carregar, se o campo estiver vazio
                if (!instance.input.value) {
                    instance.setDate("18:00", false); // Default 18:00 se vazio
                }
            },
            // Chamar updateReservationSummary ao mudar o horário de saída 
            onChange: function() {
                updateReservationSummary(
                    currentSpotDetails,
                    currentSelectedSlot.date, // Passa a data atualmente selecionada do calendário
                    startTimeInput ? startTimeInput.value : null,
                    endTimeInput.value
                );
            }
        });
    }

    let availabilityArray = [];

    if (spotDetails && Array.isArray(spotDetails.dates_availability)) {
        availabilityArray = spotDetails.dates_availability;
        console.log("openParkingDetailModal: Usando spotDetails.dates_availability diretamente como array.");
    } 
    else if (spotDetails && spotDetails.dates_availability && Array.isArray(spotDetails.dates_availability.dates_availability)) {
        availabilityArray = spotDetails.dates_availability.dates_availability;
        console.log("openParkingDetailModal: Array de disponibilidade encontrado aninhado em spotDetails.dates_availability.dates_availability.");
    }
    else if (spotDetails && Array.isArray(spotDetails.availabilities_by_date)) {
        availabilityArray = spotDetails.availabilities_by_date;
        console.log("openParkingDetailModal: Array de disponibilidade encontrado em 'availabilities_by_date'.");
    }
    else {
        console.warn("openParkingDetailModal: Não foi possível encontrar o array de datas de disponibilidade no formato esperado. Default para vazio.");
    }

    console.log("Array de disponibilidade RAW (antes do filtro):", availabilityArray);

    const availableDates = availabilityArray
        .filter(av => av.available_quantity > 0)
        .map(av => av.available_date);
        
    console.log("Datas disponíveis para o Flatpickr (enable):", availableDates);

    if (reservationCalendarInstance) {
        reservationCalendarInstance.destroy();
        console.log("Instância anterior do Flatpickr destruída.");
    }

    if (availabilityCalendar) {
        reservationCalendarInstance = flatpickr(availabilityCalendar, {
            mode: "multiple", // Seu código usa "multiple", mantendo
            dateFormat: "Y-m-d",
            locale: flatpickr.l10ns.pt,
            minDate: "today",
            enable: availableDates,
            onChange: function(selectedDates, dateStr, instance) {
                console.log("Datas selecionadas para reserva:", selectedDates);

                // Reinicia a seleção visual de slots e a seção de detalhes
                currentSelectedSlot = { date: null, slotNumber: null };
                if (selectedSlotDetailsSection) selectedSlotDetailsSection.classList.add('hidden');

                // Remove a seleção das caixas de opção de reserva ao mudar a data
                document.querySelectorAll('.reservation-option').forEach(option => {
                    option.classList.remove('selected-reservation-option');
                });
                currentSelectedReservationOption = null; // Garante que nenhuma opção está logicamente selecionada

                // Limpa a seleção visual dos quadradinhos de vaga
                if (dynamicVagaSquares) {
                    dynamicVagaSquares.querySelectorAll('.bg-purple-600, .hover\\:scale-110').forEach(el => {
                        el.classList.remove('bg-purple-600');
                        el.classList.add('bg-green-500');
                        el.classList.remove('scale-110');
                    });
                }

                if (selectedDates.length > 0) {
                    // Atualiza currentSelectedSlot.date com a primeira data selecionada (para single mode)
                    currentSelectedSlot.date = flatpickr.formatDate(selectedDates[0], "Y-m-d");

                    if (selectedDatesDisplay) {
                        selectedDatesDisplay.textContent = "Datas selecionadas: " + selectedDates.map(d => flatpickr.formatDate(d, "d/m/Y")).join(', ');
                    }
                    
                    if (availableSlotsForDateContainer) {
                        availableSlotsForDateContainer.classList.remove('hidden');
                    }

                    if (dynamicVagaSquares) {
                        dynamicVagaSquares.innerHTML = '';
                    }

                    let hasSlotsToShow = false;

                    // Itera sobre todas as datas selecionadas para exibir vagas
                    selectedDates.forEach(selectedDate => {
                        const formattedSelectedDate = flatpickr.formatDate(selectedDate, "Y-m-d");
                        const slotInfo = availabilityArray.find(av => av.available_date === formattedSelectedDate);

                        if (slotInfo && slotInfo.available_quantity > 0) {
                            hasSlotsToShow = true;
                            const dateHeader = document.createElement('h4');
                            dateHeader.className = 'text-md font-semibold text-gray-700 w-full mt-2 mb-1';
                            dateHeader.textContent = `Vagas para ${flatpickr.formatDate(selectedDate, "d/m/Y")}:`;
                            if (dynamicVagaSquares) dynamicVagaSquares.appendChild(dateHeader);

                            for (let i = 0; i < slotInfo.available_quantity; i++) {
                                const vagaSquare = document.createElement('div');
                                vagaSquare.className = 'vaga-square w-8 h-8 bg-green-500 rounded flex items-center justify-center text-white font-bold text-sm m-1 transition-transform duration-200 ease-in-out cursor-pointer';
                                vagaSquare.textContent = `${i + 1}`;
                                vagaSquare.dataset.slotNumber = i + 1;
                                vagaSquare.dataset.slotDate = formattedSelectedDate;

                                vagaSquare.addEventListener('mouseenter', () => {
                                    vagaSquare.classList.add('scale-110');
                                });
                                vagaSquare.addEventListener('mouseleave', () => {
                                    if (!vagaSquare.classList.contains('bg-purple-600')) {
                                        vagaSquare.classList.remove('scale-110');
                                    }
                                });

                                vagaSquare.addEventListener('click', () => {
                                    dynamicVagaSquares.querySelectorAll('.vaga-square').forEach(sq => {
                                        sq.classList.remove('bg-purple-600', 'scale-110');
                                        sq.classList.add('bg-green-500');
                                    });

                                    vagaSquare.classList.remove('bg-green-500');
                                    vagaSquare.classList.add('bg-purple-600', 'scale-110');

                                    currentSelectedSlot.date = formattedSelectedDate; // Atualiza a data do slot selecionado
                                    currentSelectedSlot.slotNumber = parseInt(vagaSquare.dataset.slotNumber);
                                    console.log("Vaga selecionada:", currentSelectedSlot);

                                    if (selectedSlotDetailsSection) {
                                        selectedSlotDetailsSection.classList.remove('hidden');
                                    }
                                    if (selectedSlotNumberDisplay) {
                                        selectedSlotNumberDisplay.textContent = currentSelectedSlot.slotNumber;
                                    }
                                    if (selectedSlotDateDisplay) {
                                        const displayDate = flatpickr.formatDate(selectedDate, "d/m/Y");
                                        selectedSlotDateDisplay.textContent = displayDate;
                                    }
                                    
                                    // Atualiza a calculadora quando a vaga é selecionada
                                    updateReservationSummary(
                                        currentSpotDetails,
                                        currentSelectedSlot.date,
                                        startTimeInput ? startTimeInput.value : null,
                                        endTimeInput ? endTimeInput.value : null
                                    );
                                });

                                if (dynamicVagaSquares) dynamicVagaSquares.appendChild(vagaSquare);
                            }
                        }
                    });

                    if (noSlotsMessage) {
                        if (hasSlotsToShow) {
                            noSlotsMessage.classList.add('hidden');
                        } else {
                            noSlotsMessage.classList.remove('hidden');
                            noSlotsMessage.textContent = 'Não há vagas disponíveis para as datas selecionadas.';
                        }
                    }
                    
                    // Chama updateReservationSummary após atualizar currentSelectedSlot.date 
                    updateReservationSummary(currentSpotDetails, currentSelectedSlot.date, startTimeInput.value, endTimeInput.value);


                } else { // Nenhuma data selecionada no calendário
                    if (selectedDatesDisplay) {
                        selectedDatesDisplay.textContent = "Nenhuma data selecionada ainda.";
                    }
                    if (availableSlotsForDateContainer) {
                        availableSlotsForDateContainer.classList.add('hidden');
                    }
                    if (dynamicVagaSquares) {
                        dynamicVagaSquares.innerHTML = '';
                    }
                    if (noSlotsMessage) {
                        noSlotsMessage.classList.remove('hidden');
                        noSlotsMessage.textContent = 'Selecione uma data para ver as vagas disponíveis.';
                    }
                    if (selectedSlotDetailsSection) {
                        selectedSlotDetailsSection.classList.add('hidden');
                    }
                    currentSelectedSlot = { date: null, slotNumber: null };
                    // Zera a calculadora se não houver data selecionada
                    updateReservationSummary(currentSpotDetails, null, null, null); 
                    document.querySelectorAll('.reservation-option').forEach(option => {
                        option.classList.remove('selected-reservation-option');
                    });
                    currentSelectedReservationOption = null;
                }
            }
        });
    
        // Inicializar o calendário e a calculadora na abertura ---
        let initialSelectedDateStr = null;
        if (availableDates.length > 0) {
                // Apenas limpa seleção visual, sem setar nenhuma data
            reservationCalendarInstance.clear();
            // Zera a calculadora
            updateReservationSummary(currentSpotDetails, null, null, null);
            }

        if (startTimeInput) startTimeInput.value = "";
        if (endTimeInput) endTimeInput.value = "";

    } else {
        console.error("Erro: Elemento do calendário de disponibilidade (reservation-calendar) não encontrado.");
    }

    const hourlyOptionBox = document.getElementById('reservation-option-hourly');
    const dailyOptionBox = document.getElementById('reservation-option-daily');

    if (hourlyOptionBox) {
        hourlyOptionBox.addEventListener('click', () => {
            if (currentSelectedReservationOption === 'hourly') {
                hourlyOptionBox.classList.remove('selected-reservation-option');
                currentSelectedReservationOption = null;
                // Ao desmarcar a opção "por hora", passa null para os horários
                updateReservationSummary(currentSpotDetails, currentSelectedSlot.date, null, null);
            } else {
                document.querySelectorAll('.reservation-option').forEach(option => {
                    option.classList.remove('selected-reservation-option');
                });
                hourlyOptionBox.classList.add('selected-reservation-option');
                currentSelectedReservationOption = 'hourly';
                // Chame a calculadora para exibir o cálculo por hora com os valores dos inputs
                updateReservationSummary(currentSpotDetails, currentSelectedSlot.date, startTimeInput.value, endTimeInput.value);
            }
        });
    }

    if (dailyOptionBox) {
        dailyOptionBox.addEventListener('click', () => {
            if (currentSelectedReservationOption === 'daily') {
                dailyOptionBox.classList.remove('selected-reservation-option');
                currentSelectedReservationOption = null;
                // usando os valores atuais dos inputs de tempo.
                updateReservationSummary(currentSpotDetails, currentSelectedSlot.date, startTimeInput.value, endTimeInput.value);
            } else {
                document.querySelectorAll('.reservation-option').forEach(option => {
                    option.classList.remove('selected-reservation-option');
                });
                dailyOptionBox.classList.add('selected-reservation-option');
                currentSelectedReservationOption = 'daily';
                updateReservationSummary(currentSpotDetails, currentSelectedSlot.date, null, null); 
            }
        });
    }

}

// Aba de "Minhas Reservas"
export function renderMyReservation(reservation) {
    const container = document.getElementById("myReservationsContainer");
    if (!container) return;

    const card = document.createElement("div");
    card.className = "bg-white p-4 rounded-lg shadow-md";

    // Formata a data e hora para exibição
    const startTime = new Date(reservation.start_time).toLocaleString();
    const endTime = new Date(reservation.end_time).toLocaleString();

    // Cria o HTML do cartão de reserva
    card.innerHTML = `
        <h3 class="font-bold text-lg mb-2">${reservation.spot.title}</h3>
        <p class="text-sm text-gray-600">${reservation.spot.address}</p>
        <div class="mt-3 text-sm">
            <p><strong>Início:</strong> ${startTime}</p>
            <p><strong>Fim:</strong> ${endTime}</p>
        </div>
        <div class="mt-4 flex justify-between items-center">
            <span class="font-semibold text-indigo-600">R$ ${parseFloat(reservation.total_price).toFixed(2).replace('.', ',')}</span>
            <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Reserva #${reservation.id}</span>
        </div>
    `;

    container.prepend(card);
}

export async function carregarMinhasReservas() {
    console.log("carregarMinhasReservas: Iniciando...");
    try {
        const reservations = await fetchMyReservations();
        const container = document.getElementById("myReservationsContainer");
        if (container) {
            container.innerHTML = ""; // Limpa o conteúdo anterior
            if (reservations && reservations.length > 0) {
                reservations.forEach(res => renderMyReservation(res));
            } else {
                container.innerHTML = `<p class="text-center text-gray-400 mt-6">Você ainda não possui reservas.</p>`;
            }
        }
    } catch (error) {
        console.error("Erro ao carregar minhas reservas na UI:", error);
        const container = document.getElementById("myReservationsContainer");
        if (container) {
            container.innerHTML = `<p class="text-center text-red-500 mt-6">Erro ao carregar suas reservas: ${error.message}.</p>`;
        }
    }
}

// Reservar alguma vaga  após o usuário escolher
export function showReservationConfirmation(reservationDetails) {
    const modal = document.getElementById('reservation-confirmation-modal');
    if (!modal) return;

    // Preenche o modal com os detalhes da reserva
    document.getElementById('confirmation-location').textContent = reservationDetails.spot_title;
    document.getElementById('confirmation-address').textContent = reservationDetails.spot_address;
    document.getElementById('confirmation-date').textContent = new Date(reservationDetails.start_time).toLocaleDateString();
    document.getElementById('confirmation-time').textContent = `${new Date(reservationDetails.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(reservationDetails.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    document.getElementById('confirmation-spot').textContent = "Vaga --"; // Ajuste conforme a sua API
    document.getElementById('confirmation-total').textContent = `R$ ${parseFloat(reservationDetails.total_price).toFixed(2).replace('.', ',')}`;

    // Exibe o modal
    modal.classList.remove('hidden');

    // Lógica para fechar o modal
    const closeBtn = document.getElementById('close-confirmation-btn');
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
}

const reservationForm = document.getElementById('reservation-form');
if (reservationForm) {
    reservationForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const spotId = document.getElementById('reservation-spot-id').value;
        const startTime = document.getElementById('reservation-start-time').value;
        const endTime = document.getElementById('reservation-end-time').value;

        const payload = {
            spot: spotId,
            start_time: startTime,
            end_time: endTime,
            // Adicione outros dados necessários, como preço total, etc.
        };

        try {
            const newReservation = await createReservation(payload);
            showReservationConfirmation(newReservation);
            // Opcional: Atualizar a UI para refletir a reserva (ex: desativar o botão de reserva)
        } catch (error) {
            console.error(error.message);
            alert("Não foi possível realizar a reserva: " + error.message);
        }
    });
}

// Nova função para coletar dados de múltiplas reservas e enviar
async function handleReserveButtonClick() {
    const selectedDates = reservationCalendarInstance.selectedDates;
    if (selectedDates.length === 0) {
        alert("Por favor, selecione pelo menos uma data para a reserva.");
        return;
    }

    if (!currentSpotDetails || !currentSpotId) {
        alert("Erro: Detalhes da vaga não carregados corretamente. Tente novamente.");
        console.error("currentSpotDetails ou currentSpotId estão nulos.");
        return;
    }

    const selectedVagas = dynamicVagaSquaresDiv.querySelectorAll('[data-selected="true"]');
    const reservedQuantity = selectedVagas.length;

    if (reservedQuantity === 0) {
        alert("Por favor, selecione a quantidade de vagas que deseja reservar.");
        return;
    }

    // Adicione o código aqui:
    // Garante que os modais de confirmação de exclusão e desativação estejam ocultos
    document.getElementById("delete-confirm-modal")?.classList.add("hidden");
    document.getElementById("deactivate-confirm-modal")?.classList.add("hidden");

    const reservations = [];
    selectedDates.forEach(date => {
        const backendFormattedDate = new Date(date).toISOString().split('T')[0];
        reservations.push({
            spot: currentSpotId,
            reservation_date: backendFormattedDate,
            start_time: '00:00',
            end_time: '23:59',
            reserved_quantity: reservedQuantity,
        });
    });

    console.log("Dados de reserva a serem enviados (com quadradinhos):", reservations);

    try {
        const response = await fetch('/api/reservations/bulk_create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(reservations)
        });

        if (response.ok) {
            alert(`Reserva(s) de ${reservedQuantity} vaga(s) para ${selectedDates.length} dia(s) realizada(s) com sucesso!`);
            document.getElementById("parking-detail-modal").classList.add("hidden");
            if (reservationCalendarInstance) {
                reservationCalendarInstance.clear();
            }
            carregarSpotsDaListaEdoMapa();
        } else {
            const errorData = await response.json();
            console.error("Erro ao realizar reserva(s):", errorData);
            alert(`Erro ao realizar reserva(s): ${JSON.stringify(errorData)}`);
        }
    } catch (error) {
        console.error("Erro na requisição de reserva:", error);
        alert("Ocorreu um erro ao tentar reservar. Verifique sua conexão.");
    }
}

async function renderVagaSquares(selectedDates) {
    dynamicVagaSquaresDiv.innerHTML = ''; // Limpa o conteúdo anterior
    noSlotsMessageP.classList.add('hidden'); // Oculta a mensagem "Selecione uma data..."

    if (selectedDates.length === 0) {
        noSlotsMessageP.classList.remove('hidden'); // Mostra a mensagem se nenhuma data for selecionada
        return;
    }

    if (!currentSpotId) {
        console.error("currentSpotId não definido ao tentar renderizar vagas.");
        noSlotsMessageP.textContent = "Erro: ID da vaga não disponível.";
        noSlotsMessageP.classList.remove('hidden');
        return;
    }

    const formattedDatesForApi = selectedDates.map(date => new Date(date).toISOString().split('T')[0]).join(',');
    console.log("Datas formatadas para API (para depuração):", formattedDatesForApi);

    try {
        // Fetch para a API de disponibilidade
        const response = await fetch(`/parking/api/spots/${currentSpotId}/availability/?dates=${formattedDatesForApi}`);

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Erro ao buscar disponibilidade:", errorData);
            noSlotsMessageP.textContent = `Erro ao buscar vagas: ${errorData.detail || response.statusText}`;
            noSlotsMessageP.classList.remove('hidden');
            return;
        }

        const data = await response.json();
        console.log("Dados de disponibilidade da API:", data);

        let totalAvailableSlotsToDisplay = 0; // Valor para desenhar os quadrados
    
        if (data.dates_availability && data.dates_availability.length > 0) {
            // Se você quer exibir a disponibilidade do PRIMEIRO dia selecionado
            const firstSelectedDate = selectedDates[0];
            const firstFormattedDate = new Date(firstSelectedDate).toISOString().split('T')[0];
            const availabilityForFirstDate = data.dates_availability.find(
                item => item.date === firstFormattedDate
            );
            totalAvailableSlotsToDisplay = availabilityForFirstDate ? availabilityForFirstDate.available_slots : 0;

            if (totalAvailableSlotsToDisplay > 0) {
            noSlotsMessageP.textContent = `Vagas disponíveis para ${new Date(firstSelectedDate).toLocaleDateString('pt-BR')}:`;
            } else {
            noSlotsMessageP.textContent = `Nenhuma vaga disponível para ${new Date(firstSelectedDate).toLocaleDateString('pt-BR')}.`;
            }
            noSlotsMessageP.classList.remove('hidden');
            
         } else if (data.capacity !== undefined) {
        totalAvailableSlotsToDisplay = data.capacity; 
        noSlotsMessageP.textContent = `Capacidade total da vaga (sem disponibilidade por data específica):`;
        noSlotsMessageP.classList.remove('hidden');
    } else {
        noSlotsMessageP.textContent = 'Nenhuma informação de disponibilidade encontrada para as datas selecionadas.';
        noSlotsMessageP.classList.remove('hidden');
        return;
    }

        // Se a quantidade disponível é maior que zero, desenha os quadrados
        if (totalAvailableSlotsToDisplay > 0) {
            dynamicVagaSquaresDiv.innerHTML = ''; // Limpa o contêiner

            for (let i = 1; i <= totalAvailableSlotsToDisplay; i++) {
                const square = document.createElement('div');
                square.classList.add(
                    'w-10', 'h-10', 'rounded-md', 'flex', 'items-center', 'justify-center',
                    'font-bold', 'text-white', 'text-lg', 'cursor-pointer', 'select-none',
                    'border-2', 'transition-colors'
                );
                square.textContent = i; // Número da vaga

                square.classList.add('border-green-500', 'bg-green-500', 'hover:bg-green-600', 'hover:border-green-600');
                square.dataset.vagaNumber = i;
                square.dataset.selected = 'false'; // Estado de seleção inicial

                square.addEventListener('click', () => {
                    if (square.dataset.selected === 'true') {
                        square.classList.remove('bg-indigo-600', 'border-indigo-600');
                        square.classList.add('bg-green-500', 'border-green-500');
                        square.dataset.selected = 'false';
                    } else {
                        square.classList.remove('bg-green-500', 'border-green-500');
                        square.classList.add('bg-indigo-600', 'border-indigo-600');
                        square.dataset.selected = 'true';
                    }
                });
                dynamicVagaSquaresDiv.appendChild(square);
            }
        } else {
            noSlotsMessageP.textContent = 'Nenhuma vaga disponível para reserva nas datas selecionadas.';
            noSlotsMessageP.classList.remove('hidden');
        }

    } catch (error) {
        console.error("Erro na requisição da API de disponibilidade:", error);
        noSlotsMessageP.textContent = "Erro ao carregar disponibilidade das vagas. Verifique sua conexão ou tente novamente.";
        noSlotsMessageP.classList.remove('hidden');
    }
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
}