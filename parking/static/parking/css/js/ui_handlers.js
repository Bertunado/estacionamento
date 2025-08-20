// ui_handlers.js
// Funções responsáveis por renderizar elementos na interface e gerenciar modais/abas

import { fetchMySpots, fetchSpots, deleteSpot, updateSpotStatus, createReservation, fetchMyReservations, fetchSpotReservations } from './api_services.js';
import { initializeAutocomplete, configurarBuscaEndereco, initMap, map, carregarSpots as carregarSpotsDoMapa } from './map_utilities.js';
import { getCookie } from './utils.js'; // Ajuste o caminho conforme a estrutura de pastas
import { setupAvailabilityFields } from './availability_manager.js';
import { createMiniMap } from './map_utilities.js'; 

// Variáveis para guardar o estado do modal de reserva
let currentSpotId = null;
let dynamicVagaSquaresDiv;
let noSlotsMessageP;
let reservationCalendarInstance = null;
let currentSpotDetails = null;
let currentSelectedReservationOption = null;
let isProcessingDate = false;
let currentSelectedSlot = {
    date: null,
    slotNumber: null
};
window.currentSpotData = null; 


function initializeReservationCalendar(availableDates) {
  const availabilityCalendar = document.getElementById('reservation-calendar');

    if (availabilityCalendar) {
        // Verifica se já existe uma instância e a destrói para evitar duplicação
        if (availabilityCalendar._flatpickr) {
            availabilityCalendar._flatpickr.destroy();
        }

        flatpickr(availabilityCalendar, {
            inline: true,
            enable: availableDates,
            enableTime: true,
            noCalendar: false,
            mode: "multiple",
            dateFormat: "Y-m-d",
            locale: flatpickr.l10ns.pt,
            dateFormat: "Y-m-d H:i",
            time_24hr: true,
            minDate: "today",
            enable: availableDates,
            onChange: function(selectedDates, dateStr, instance) {
                console.log("Datas selecionadas para reserva:", selectedDates);
            
                if (dateStr) {
                    const spotId = document.getElementById('reservation-spot-id').value;
                    if (spotId) {
                        handleDateSelection(spotId, dateStr); 
                    } else {
                        console.warn("Nenhum spotId encontrado para carregar as reservas.");
                    }
                } else {
                    document.getElementById('reserved-slots-list').innerHTML = '';
                    document.getElementById('reserved-slots-for-date').classList.add('hidden');
                }
            }
        });
    }
}

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

    // Lógica para interagir com o mapa APENAS quando a aba 'parkings' estiver ativa
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
    } else if (tabName === 'my-reservations') {
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

        window.allSpots = spots; 

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
                src="${spot.photos && spot.photos.length > 0 ? spot.photos[0] : '/static/parking/css/images/placeholder.png'}"
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
            event.stopPropagation(); 
            console.log(`Botão de editar para a vaga ${spot.id} clicado.`);
            openEditSpotModal(spot); 
        });
    }

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
    
    // Preenche o formulário com os dados da vaga
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
function renderReservedSlots(occupiedTimes, selectedDateStr) {
    const reservedSlotsList = document.getElementById('reserved-slots-list');
    const reservedSlotsSection = document.getElementById('reserved-slots-for-date');
    const noReservedSlotsMessage = document.getElementById('no-reserved-slots-message');

    reservedSlotsList.innerHTML = '';
    
    if (occupiedTimes && occupiedTimes.length > 0) {
        reservedSlotsSection.classList.remove('hidden');
        noReservedSlotsMessage.classList.add('hidden');
        
        occupiedTimes.forEach(time => {
            const timeItem = document.createElement('p');
            timeItem.className = 'text-sm text-gray-600';

            // ✅ CORREÇÃO: Adicione o 'Z' para indicar que o horário da API é UTC
            const startDateTimeUTC = new Date(`${selectedDateStr}T${time.start}:00Z`);
            const endDateTimeUTC = new Date(`${selectedDateStr}T${time.end}:00Z`);
            
            // Verifica se a conversão foi bem-sucedida
            if (isNaN(startDateTimeUTC) || isNaN(endDateTimeUTC)) {
                timeItem.textContent = `Horário inválido: Das ${time.start} às ${time.end}`;
            } else {
                // toLocaleTimeString agora converterá o horário UTC para o fuso local
                const formattedStart = startDateTimeUTC.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const formattedEnd = endDateTimeUTC.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                timeItem.textContent = `Das ${formattedStart} às ${formattedEnd}`;
            }

            reservedSlotsList.appendChild(timeItem);
        });
    } else {
        reservedSlotsSection.classList.remove('hidden');
        noReservedSlotsMessage.classList.remove('hidden');
    }
}



// Carregar as reservas quando a data for selecionada
export async function handleDateSelection(spotId, selectedDates) {
    currentSpotId = spotId;
    currentSelectedSlot = { date: null, slotNumber: null };

    document.getElementById('no-slots-message').classList.add('hidden');
    document.getElementById('dynamic-vaga-squares').innerHTML = '';
    
    document.getElementById('reserved-slots-list').innerHTML = '';
    document.getElementById('reserved-slots-for-date').classList.add('hidden');

    // ✅ Passa a lista completa de datas selecionadas para renderVagaSquares
    await renderVagaSquares(selectedDates);
}

function isTimeOverlap(userStart, userEnd, occupiedTimes, slotDate) {
    for (const time of occupiedTimes) {
        // ✅ CORREÇÃO: Adicione o 'Z' para tratar o horário da API como UTC
        const occupiedStartUTC = new Date(`${slotDate}T${time.start}:00Z`);
        const occupiedEndUTC = new Date(`${slotDate}T${time.end}:00Z`);
        
        // A comparação agora é feita em UTC para garantir a precisão
        if (
            (userStart.getTime() < occupiedEndUTC.getTime() && userEnd.getTime() > occupiedStartUTC.getTime())
        ) {
            return true;
        }
    }
    return false;
}

document.addEventListener('DOMContentLoaded', () => {
    const confirmReservationBtn = document.getElementById('confirm-reservation-btn');
    if (confirmReservationBtn) {
        confirmReservationBtn.addEventListener('click', async () => {
            console.log('Botão de confirmar reserva clicado!');

            const spotId = document.getElementById('reservation-spot-id').value;
            const startTime = document.getElementById('start-time-input').value;
            const endTime = document.getElementById('end-time-input').value;
            const selectedDateStr = currentSelectedSlot.date; 
            
            const timeOverlapErrorP = document.getElementById('time-overlap-error');
            timeOverlapErrorP.classList.add('hidden');

            if (currentSelectedSlot.slotNumber === null) {
                alert("Por favor, selecione a vaga física.");
                return;
            }
            const slotNumber = currentSelectedSlot.slotNumber;

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

            // ✅ CORREÇÃO: Remova a navegação segura e adicione um 'return' no caso de dados ausentes
            const selectedAvailability = window.currentSpotData.dates_availability.find(av => av.date === selectedDateStr);
            if (!selectedAvailability) {
                console.error("Dados de disponibilidade para a data selecionada não encontrados.");
                alert("Ocorreu um erro ao verificar a disponibilidade. Tente novamente.");
                return;
            }
            
            const selectedSlotData = selectedAvailability.slots.find(s => s.slot_number === slotNumber);
            if (!selectedSlotData) {
                console.error("Dados de disponibilidade para o slot selecionado não encontrados.");
                alert("Ocorreu um erro ao verificar a disponibilidade. Tente novamente.");
                return;
            }
            
            const occupiedTimes = selectedSlotData.occupied_times;

            // ✅ Este bloco agora será alcançado
            if (isTimeOverlap(startDateTime, endDateTime, occupiedTimes, selectedDateStr)) {
                timeOverlapErrorP.textContent = "O horário selecionado já está parcial ou totalmente ocupado. Por favor, escolha outro horário.";
                timeOverlapErrorP.classList.remove('hidden');
                return;
            }

            const payload = {
                spot: parseInt(spotId),
                slot_number: slotNumber,
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
            };
            console.log("Payload enviado para a API:", payload);

            try {
    const newReservation = await createReservation(payload);

    // Mostra o modal de confirmação
    showReservationConfirmation({
    tipo_vaga: newReservation.tipo_vaga,
    slot_number: newReservation.slot_number,
    start_time: newReservation.start_time,
    end_time: newReservation.end_time,
    total_price: newReservation.total_price
});

    renderVagaSquares([selectedDateStr]); 
}catch (error) {
    alert(`Erro ao criar a reserva: ${error.message}`);
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

function formatDateToISO(date) {
    if (!(date instanceof Date)) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

        if (endDateTime <= startDateTime) {
            endDateTime.setDate(endDateTime.getDate() + 1);
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
        if (minutes > 0 || (hours === 0 && minutes === 0 && durationMinutes === 0)) { 
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
    return '24h/dia (aprox.)'; 
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

    const reservationSpotIdInput = document.getElementById('reservation-spot-id');
    if (reservationSpotIdInput) {
        reservationSpotIdInput.value = spotDetails.id;
    } else {
        console.error("Erro: Elemento reservation-spot-id não encontrado.");
    }
    
    document.getElementById('parking-detail-modal').classList.remove('hidden');

    // Atualiza a imagem da vaga
    const modalImage = document.getElementById("modal-parking-image");
if (modalImage) {
    // Verifica se existem fotos e se o primeiro item do array é uma string válida
    if (spotDetails.photos && spotDetails.photos.length > 0 && typeof spotDetails.photos[0] === 'string') {
        modalImage.src = spotDetails.photos[0];
    } else {
        modalImage.src = '/static/parking/css/images/placeholder.png';
    }
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
    // Verifica se os dados do proprietário existem
    if (spotDetails.owner && spotDetails.owner.perfil) {
        // Acessa o nome completo do perfil
        modalSellerName.textContent = spotDetails.owner.perfil.nome_completo || 'Vendedor não disponível';

        // Acessa a URL da foto do perfil e a atribui ao src da imagem.
        const sellerPhotoUrl = spotDetails.owner.perfil.foto;
        if (sellerPhotoUrl) {
            modalSellerProfileImage.src = sellerPhotoUrl;
        }

    } else {
        // Caso os dados não estejam disponíveis
        modalSellerName.textContent = 'Vendedor não disponível';
    }
}
profileImage.addEventListener('click', (e) => {
    e.stopPropagation(); 
    popover.classList.toggle('hidden');

    // Atualizar o nome no popover dinamicamente
    const sellerName = document.getElementById('modal-seller-name');
    const popoverName = document.getElementById('popover-seller-name');
    if (sellerName && popoverName) {
        popoverName.textContent = sellerName.textContent;
    }

    const rect = profileImage.getBoundingClientRect();
    popover.style.top = `${rect.bottom + window.scrollY + 5}px`;
    popover.style.left = `${rect.left + window.scrollX}px`;
});

document.addEventListener('click', (e) => {
    if (!popover.contains(e.target) && !profileImage.contains(e.target)) {
        popover.classList.add('hidden');
    }
});

    if (startTimeInput && startTimeInput._flatpickr) {
        startTimeInput._flatpickr.destroy();
    }
    if (endTimeInput && endTimeInput._flatpickr) {
        endTimeInput._flatpickr.destroy();
    }
    if (reservationCalendarInstance) {
        reservationCalendarInstance.destroy(); 
        reservationCalendarInstance = null;
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
                    instance.setDate("08:00", false); 
                }
            },
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
            onChange: function() {
                updateReservationSummary(
                    currentSpotDetails,
                    currentSelectedSlot.date, 
                    startTimeInput ? startTimeInput.value : null,
                    endTimeInput.value
                );
            }
        });
    }

    const availabilityCalendar = modal.querySelector('#reservation-calendar');
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

    const availableDates = availabilityArray
        .filter(av => av.available_quantity > 0)
        .map(av => av.available_date);

    if (availabilityCalendar) {
    reservationCalendarInstance = flatpickr(availabilityCalendar, {
        mode: "multiple",
        dateFormat: "Y-m-d",
        locale: flatpickr.l10ns.pt,
        minDate: "today",
        enable: availableDates,
        onChange: function(selectedDates, dateStr, instance) {

            if (isProcessingDate) {
                console.log("Processamento de data em andamento. Ignorando evento duplicado.");
                return;
            }

            // Lógica para quando uma ou mais datas são selecionadas
            if (selectedDates && selectedDates.length > 0) {
                isProcessingDate = true;
                const spotId = document.getElementById('reservation-spot-id').value;
                
                if (spotId) {
                    // ✅ Chama a função com a lista completa de datas selecionadas.
                    handleDateSelection(spotId, selectedDates)
                        .finally(() => {
                            isProcessingDate = false;
                        });
                } else {
                    console.warn("Nenhum spotId encontrado para carregar as reservas.");
                    isProcessingDate = false;
                }
                
                if (selectedDatesDisplay) {
                    selectedDatesDisplay.textContent = "Datas selecionadas: " + selectedDates.map(d => flatpickr.formatDate(d, "d/m/Y")).join(', ');
                }
                if (availableSlotsForDateContainer) {
                    availableSlotsForDateContainer.classList.remove('hidden');
                }
                
            } else { // Lógica para quando nenhuma data está selecionada
                document.getElementById('dynamic-vaga-squares').innerHTML = '';
                document.getElementById('reserved-slots-list').innerHTML = '';
                document.getElementById('reserved-slots-for-date').classList.add('hidden');
                
                document.getElementById('no-slots-message').textContent = 'Selecione uma data para ver as vagas disponíveis.';
                document.getElementById('no-slots-message').classList.remove('hidden');

                updateReservationSummary(currentSpotDetails, null, null, null); 
            }
        }
    });
    
    // Inicializar o calendário e a calculadora na abertura
    if (availableDates.length > 0) {
        reservationCalendarInstance.clear();
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
                updateReservationSummary(currentSpotDetails, currentSelectedSlot.date, null, null);
            } else {
                document.querySelectorAll('.reservation-option').forEach(option => {
                    option.classList.remove('selected-reservation-option');
                });
                hourlyOptionBox.classList.add('selected-reservation-option');
                currentSelectedReservationOption = 'hourly';
                updateReservationSummary(currentSpotDetails, currentSelectedSlot.date, startTimeInput.value, endTimeInput.value);
            }
        });
    }

    if (dailyOptionBox) {
        dailyOptionBox.addEventListener('click', () => {
            if (currentSelectedReservationOption === 'daily') {
                dailyOptionBox.classList.remove('selected-reservation-option');
                currentSelectedReservationOption = null;
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

export function renderMyReservation(reservation) {
    const container = document.getElementById("myReservationsContainer");
    if (!container) return;

    const card = document.createElement("div");
    card.className = "bg-white rounded-lg shadow-lg overflow-hidden flex flex-col";

    // Imagem da vaga
    const img = document.createElement("img");
    const photoUrl = reservation.spot.photos && reservation.spot.photos.length > 0
        ? reservation.spot.photos[0]
        : '/static/parking/css/images/placeholder.png';
    img.src = photoUrl;
    img.alt = reservation.spot.title || "Vaga";
    img.className = "w-full h-48 object-cover";
    card.appendChild(img);

    // Conteúdo do card
    const content = document.createElement("div");
    content.className = "p-4 flex flex-col flex-1 relative";

    const statusContainer = document.createElement("div");
    statusContainer.className = "absolute top-4 right-2";

    const statusSpan = document.createElement("span");
    statusSpan.className = "text-xs px-2 py-1 rounded font-semibold";

    const now = new Date();
    const endDate = new Date(reservation.end_time);

    if (now < endDate) {
        // A reserva ainda está ativa
        statusSpan.textContent = "Disponível";
        statusSpan.classList.add("bg-green-100", "text-green-800");
    } else {
        // A reserva já terminou
        statusSpan.textContent = "Finalizada";
        statusSpan.classList.add("bg-gray-100", "text-gray-800");
    }

    // ✅ CORREÇÃO: Anexar o statusSpan ao statusContainer.
    statusContainer.appendChild(statusSpan);

    // ✅ CORREÇÃO: Anexar o statusContainer ao content ANTES do título e outras informações.
    content.appendChild(statusContainer);

    // Título da vaga (Nome do estacionamento)
    const title = document.createElement("h3");
    title.className = "text-lg font-bold text-gray-800 mb-1";
    title.textContent = reservation.spot.title || "Estacionamento sem título";
    content.appendChild(title);

    // Vendedor (foto e nome)
    const sellerInfo = document.createElement("div");
    sellerInfo.className = "flex items-center space-x-2 mb-4";
    
    const sellerPhoto = document.createElement("img");
    sellerPhoto.src = (reservation.spot.owner && reservation.spot.owner.perfil && reservation.spot.owner.perfil.foto) 
        ? reservation.spot.owner.perfil.foto 
        : '/static/parking/css/images/default-profile.png';
    
    sellerPhoto.alt = (reservation.spot.owner && reservation.spot.owner.perfil && reservation.spot.owner.perfil.nome_completo) 
        ? reservation.spot.owner.perfil.nome_completo 
        : "Vendedor";
    sellerPhoto.className = "w-8 h-8 rounded-full object-cover";
    sellerInfo.appendChild(sellerPhoto);

    const sellerName = document.createElement("p");
    sellerName.className = "text-sm text-gray-500";
    sellerName.textContent = (reservation.spot.owner && reservation.spot.owner.perfil && reservation.spot.owner.perfil.nome_completo) 
        ? `Vendedor: ${reservation.spot.owner.perfil.nome_completo}` 
        : 'Vendedor: Indisponível';
    sellerInfo.appendChild(sellerName);

    content.appendChild(sellerInfo);

    // Botão de detalhes
    const button = document.createElement("button");
    button.className = "mt-auto bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition duration-200";
    button.textContent = "Mostrar detalhes >";

    button.addEventListener("click", () => {
        openReservationDetailModal(reservation);
    });

    content.appendChild(button);
    card.appendChild(content);

    container.appendChild(card);
}

export async function openReservationDetailModal(reservation) {
    console.log("Objeto de reserva recebido:", reservation);

    const modal = document.getElementById('reservation-detail-modal');
    if (!modal) return console.error("Modal de detalhes da reserva não encontrado.");

    const spot = reservation.spot;

    // Preenche informações da vaga
    document.getElementById("modal-reservation-title").textContent = spot.title;
    document.getElementById("modal-reservation-address").textContent = spot.address;

    const modalImage = document.getElementById("modal-reservation-image");
    if (modalImage) {
        modalImage.src = spot.photos?.[0] || '';
        modalImage.alt = spot.description || spot.title;
    }

    // Datas e horários
    const startDate = new Date(reservation.start_time);
    const endDate = new Date(reservation.end_time);
    document.getElementById("reservation-date-display").textContent = startDate.toLocaleDateString('pt-BR');
    document.getElementById("reservation-time-display").textContent =
        `${startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} até ${endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    document.getElementById("reservation-slot-number-display").textContent = reservation.slot_number;
    document.getElementById("reservation-total-price-display").textContent =
        `R$ ${parseFloat(reservation.total_price).toFixed(2).replace('.', ',')}`;

    // Dados do vendedor
    const owner = spot.owner || reservation.owner;
    if (owner) {
        const sellerName = document.getElementById('modal-seller-name-detail');
        const sellerPhoto = document.getElementById('modal-seller-profile-image-detail');
        if (sellerName) sellerName.textContent = owner.perfil?.nome_completo || 'Indisponível';
        if (sellerPhoto) {
            sellerPhoto.src = owner.perfil?.foto || '/static/parking/css/images/default-profile.png';
            sellerPhoto.alt = owner.perfil?.nome_completo || 'Vendedor não disponível';
        }
    }

    // Mostra a modal antes de criar o mapa
    modal.classList.remove('hidden');

        const lat = spot.latitude;
        const lng = spot.longitude;
        console.log(`Coordenadas da vaga: lat=${lat}, lng=${lng}`);


    // Espera a API do Google Maps estar carregada
    if (spot.latitude && spot.longitude) {
        await new Promise(resolve => {
            const waitForMaps = () => {
                if (window.google && google.maps && google.maps.importLibrary) resolve();
                else setTimeout(waitForMaps, 50);
            };
            waitForMaps();
        });

        // Espera o próximo frame para garantir que o div do mapa já tem tamanho
        requestAnimationFrame(() => {
            console.log("Abrindo modal");

            createMiniMap("reservation-map", spot.latitude, spot.longitude, spot.title);
        });
    }

    // Botão iniciar rota
    const startRouteBtn = document.getElementById('start-route-button');
    if (startRouteBtn) startRouteBtn.onclick = () => {
        const destination = encodeURIComponent(spot.address);
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`, '_blank');
    };

    // Fechar modal
    const closeBtn = document.getElementById("close-reservation-modal");
    if (closeBtn) closeBtn.onclick = () => modal.classList.add("hidden");

    console.log("Modal aberta com detalhes da reserva.");
}


// Aba de "Minhas Reservas"
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

    const tipoVagaFormatado = formatarTipoVaga(reservationDetails.tipo_vaga);
    document.getElementById('confirmation-location').textContent = tipoVagaFormatado;

    document.getElementById('confirmation-date').textContent = new Date(reservationDetails.start_time).toLocaleDateString('pt-BR');
    document.getElementById('confirmation-time').textContent = `${new Date(reservationDetails.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - ${new Date(reservationDetails.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    
    document.getElementById('confirmation-spot').textContent = `V${reservationDetails.slot_number}`;
    document.getElementById('confirmation-total').textContent = `R$ ${parseFloat(reservationDetails.total_price).toFixed(2).replace('.', ',')}`;

    modal.classList.remove('hidden');

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
        };

        try {
            const newReservation = await createReservation(payload);
            showReservationConfirmation(newReservation);
        } catch (error) {
            console.error(error.message);
            alert("Não foi possível realizar a reserva: " + error.message);
        }
    });
}

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
    const dynamicVagaSquaresDiv = document.getElementById('dynamic-vaga-squares');
    const noSlotsMessageP = document.getElementById('no-slots-message');

    if (!dynamicVagaSquaresDiv || !noSlotsMessageP) {
        console.error("Elementos do DOM não encontrados!");
        return;
    }

    dynamicVagaSquaresDiv.innerHTML = '';
    noSlotsMessageP.classList.add('hidden');

    if (selectedDates.length === 0) {
        noSlotsMessageP.textContent = 'Por favor, selecione uma data no calendário.';
        noSlotsMessageP.classList.remove('hidden');
        return;
    }

    if (!currentSpotId) {
        console.error("currentSpotId não definido ao tentar renderizar vagas.");
        noSlotsMessageP.textContent = "Erro: ID da vaga não disponível.";
        noSlotsMessageP.classList.remove('hidden');
        return;
    }

    const formattedDatesForApi = selectedDates.map(date => new Date(date).toISOString().split('T')[0]).join(',');

     try {
        const response = await fetch(`/parking/api/spots/${currentSpotId}/availability/?dates=${formattedDatesForApi}`);
        const data = await response.json();
        
        console.log("Dados de disponibilidade da API:", data);
        
        // ✅ CORREÇÃO: Salve os dados da API em uma variável global
        window.currentSpotData = data; 

        if (!response.ok) {
            console.error("Erro ao buscar disponibilidade:", data);
            noSlotsMessageP.textContent = `Erro ao buscar vagas: ${data.detail || response.statusText}`;
            noSlotsMessageP.classList.remove('hidden');
            return;
        }

        let hasSlotsToShow = false;
        
        if (data.dates_availability && Array.isArray(data.dates_availability) && data.dates_availability.length > 0) {
            data.dates_availability.forEach(availability => {
                if (availability.slots && Array.isArray(availability.slots) && availability.slots.length > 0) {
                    hasSlotsToShow = true;
                    
                    const dateHeader = document.createElement('h4');
                    dateHeader.className = 'text-md font-semibold text-gray-700 w-full mt-4 mb-2';
                    dateHeader.textContent = `Vagas para ${new Date(availability.date).toLocaleDateString('pt-BR')}:`;
                    dynamicVagaSquaresDiv.appendChild(dateHeader);

                    const slotsContainer = document.createElement('div');
                    slotsContainer.className = 'flex flex-wrap';
                    
                    availability.slots.forEach(slot => {
                        const square = document.createElement('div');
                        
                        const isFullyOccupied = slot.occupied_times.length > 0;
                        
                        square.classList.add(
                            'vaga-square', 'w-10', 'h-10', 'rounded-md', 'flex', 
                            'items-center', 'justify-center', 'font-bold', 'text-white', 
                            'text-lg', 'select-none', 'border-2', 'transition-colors', 'm-1', 'cursor-pointer'
                        );
                        square.textContent = slot.slot_number;
                        square.dataset.vagaNumber = slot.slot_number;
                        square.dataset.slotDate = availability.date; 
                        square.dataset.selected = 'false';

                        if (isFullyOccupied) {
                            square.classList.add('border-yellow-500', 'bg-yellow-500', 'hover:bg-yellow-600');
                        } else {
                            square.classList.add('border-green-500', 'bg-green-500', 'hover:bg-green-600');
                        }
                        
                        square.addEventListener('click', async () => {
                            document.querySelectorAll('.vaga-square').forEach(otherSquare => {
                                if (otherSquare.dataset.selected === 'true') {
                                    // Remove o estilo de seleção
                                    otherSquare.classList.remove('bg-indigo-600', 'border-indigo-600');
                                    
                                    // Restaura a cor original baseada na ocupação
                                    const otherSlotDate = otherSquare.dataset.slotDate;
                                    const otherSlotNumber = otherSquare.dataset.vagaNumber;
                                    const otherAvailability = data.dates_availability.find(av => av.date === otherSlotDate);
                                    const otherSlot = otherAvailability.slots.find(s => s.slot_number.toString() === otherSlotNumber);
                                    if (otherSlot.occupied_times.length > 0) {
                                         otherSquare.classList.add('bg-yellow-500', 'border-yellow-500');
                                    } else {
                                         otherSquare.classList.add('bg-green-500', 'border-green-500');
                                    }
                                    otherSquare.dataset.selected = 'false';
                                }
                            });
                            
                            square.classList.remove('bg-green-500', 'border-green-500', 'bg-yellow-500', 'border-yellow-500');
                            square.classList.add('bg-indigo-600', 'border-indigo-600');
                            square.dataset.selected = 'true';
                            
                            currentSelectedSlot.date = square.dataset.slotDate;
                            currentSelectedSlot.slotNumber = parseInt(square.dataset.vagaNumber);
                            
                            document.getElementById('selected-slot-details-section').classList.remove('hidden');
                            document.getElementById('selected-slot-number').textContent = currentSelectedSlot.slotNumber;
                            document.getElementById('selected-slot-date-display').textContent = new Date(currentSelectedSlot.date).toLocaleDateString('pt-BR');
                            
                            // ✅ Renderiza os horários reservados
                            const selectedAvailability = data.dates_availability.find(av => av.date === currentSelectedSlot.date);
                            const selectedSlotData = selectedAvailability.slots.find(s => s.slot_number === currentSelectedSlot.slotNumber);
                            renderReservedSlots(selectedSlotData.occupied_times, currentSelectedSlot.date);
                        });
                        slotsContainer.appendChild(square);
                    });
                    dynamicVagaSquaresDiv.appendChild(slotsContainer);
                }
            });
        }
        
         if (!hasSlotsToShow) {
            noSlotsMessageP.textContent = 'Não há vagas disponíveis para a data selecionada.';
            noSlotsMessageP.classList.remove('hidden');
        }

    } catch (error) {
        console.error("Erro na requisição da API de disponibilidade:", error);
        window.currentSpotData = null; // ✅ Garante que a variável seja limpa em caso de erro
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