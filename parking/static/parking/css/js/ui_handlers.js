// ui_handlers.js
// Funções responsáveis por renderizar elementos na interface e gerenciar modais/abas

import { fetchMySpots, fetchSpots, deleteSpot, updateSpotStatus } from './api_services.js';
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


document.addEventListener('DOMContentLoaded', () => {
    reservationModal = document.getElementById('parking-detail-modal');

    availableSlotsForDateDiv = document.getElementById('available-slots-for-date');
    dynamicVagaSquaresDiv = document.getElementById('dynamic-vaga-squares');  
    noSlotsMessageP = document.getElementById('no-slots-message');

    modalParkingTitle = document.getElementById('modal-parking-title');
    modalParkingAddress = document.getElementById('modal-parking-address');
    modalParkingDescription = document.getElementById('modal-parking-description');
    modalParkingType = document.getElementById('modal-parking-type');
    modalParkingQuantity = document.getElementById('modal-parking-quantity');
    modalSpotPriceHourElement = document.getElementById('modal-spot-price-hour');
    modalSpotLocationElement = document.getElementById('modal-spot-location'); // Você precisa adicionar um ID ao elemento de localização no HTML
    modalParkingImage = reservationModal.querySelector('img');

    if (reservationModal) {
        const reservationCalendarInput = document.getElementById('reservation-calendar'); // Input onde o Flatpickr se anexa
        const selectedDatesDisplay = document.getElementById('selected-reservation-dates-display'); // Div para exibir as datas selecionadas

        if (reservationCalendarInput && selectedDatesDisplay && availableSlotsForDateDiv && dynamicVagaSquaresDiv  && noSlotsMessageP) {
            reservationCalendarInstance = flatpickr(reservationCalendarInput, {
                mode: "multiple", // Essencial para selecionar múltiplas datas
                dateFormat: "d/m/Y",
                locale: flatpickr.l10ns.pt,
                minDate: "today",
                onReady: function(selectedDates, dateStr, instance) {
                    instance.clear(); // Limpa seleção inicial
                    selectedDatesDisplay.textContent = 'Nenhuma data selecionada ainda.';
                    availableSlotsForDateDiv.classList.add('hidden'); // Oculta a área de slots
                    noSlotsMessageP.classList.remove('hidden'); // Mostra a mensagem inicial de slots
                    dynamicVagaSquaresDiv .innerHTML = ''; // Limpa os slots dinâmicos
                },
                onChange: function(selectedDates, dateStr, instance) {
                    if (selectedDates.length > 0) {
                        const formattedDates = selectedDates.map(date =>
                            new Date(date).toLocaleDateString('pt-BR')
                        ).join(', ');
                        selectedDatesDisplay.textContent = `Datas selecionadas: ${formattedDates}`;
                        availableSlotsForDateDiv.classList.remove('hidden'); // Mostra a área de slots
                        renderVagaSquares(selectedDates); 
                    } else {
                        selectedDatesDisplay.textContent = 'Nenhuma data selecionada ainda.';
                        availableSlotsForDateDiv.classList.add('hidden'); // Oculta a área de slots
                        noSlotsMessageP.classList.remove('hidden'); // Mostra a mensagem inicial de slots
                        dynamicVagaSquaresDiv.innerHTML = ''; // LIMPA OS QUADRADINHOS
                    }
                }
            });
            console.log("ui_handlers.js: Flatpickr para reserva inicializado.");
        } else {
            console.warn("ui_handlers.js: Um ou mais elementos do calendário/slots de reserva (modal) não encontrados. Verifique os IDs.");
        }
    } else {
        console.warn("ui_handlers.js: Elemento 'parking-detail-modal' não encontrado no DOM. O modal de reserva pode não funcionar.");
    }

    // Listener para o botão de Confirmação de Reserva, se existir no modal.
    const confirmReservationBtn = document.getElementById("confirm-reservation-btn");
    if (confirmReservationBtn) {
        confirmReservationBtn.addEventListener("click", handleReserveButtonClick);
    } else {
        console.warn("ui_handlers.js: Botão 'confirm-reservation-btn' não encontrado. A reserva não poderá ser confirmada.");
    }

    if (reservationModal) {
        // ...
        const closeDetailModalButton = document.getElementById('close-modal'); // Já existe no seu HTML
        if (closeDetailModalButton) {
            closeDetailModalButton.addEventListener('click', () => {
                reservationModal.classList.add('hidden'); // Oculta o modal de detalhes/reserva
            });
        }
    }
});

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
    } else if (tabName === "add-parking") {
        console.log("activateTab: Aba 'add-parking' ativada.");
        setTimeout(() => {
            initializeAutocomplete();
            // --- ADICIONAR A CHAMADA PARA setupAvailabilityFields AQUI ---
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

// Função auxiliar para obter a quantidade disponível para uma data específica
function getAvailableQuantityForDate(spot, selectedDateStr) {
    if (!spot.availabilities || spot.availabilities.length === 0) {
        return 0; // Nenhuma disponibilidade cadastrada
    }
    const availability = spot.availabilities.find(
        (avail) => avail.available_date === selectedDateStr
    );
    return availability ? availability.available_quantity : 0;
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
            openParkingDetailModal(spot);
        });
    }

    card.addEventListener("click", () => {
        openParkingDetailModal(spot);
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

            const modalMessage = modalConfirm?.querySelector('.modal-message-placeholder');

            if (modalConfirm && confirmBtn && modalMessage) {
                modalMessage.textContent = `Tem certeza que deseja ${currentAction} esta vaga?`;

                confirmBtn.dataset.spotId = spot.id;
                confirmBtn.dataset.newStatus = newStatus;
                confirmBtn.dataset.actionType = currentAction;

                modalConfirm.classList.remove("hidden");
            } else {
                console.warn("Elemento(s) do modal de desativação/ativação não encontrado(s). Usando confirmação padrão.");
                if (confirm(`Tem certeza que deseja ${currentAction} esta vaga?`)) {
                    updateSpotStatus(spot.id, newStatus)
                        .then(() => {
                            alert(`Vaga ${newStatus.toLowerCase()} com sucesso!`);
                            carregarMinhasVagas();
                        })
                        .catch(error => {
                            console.error(`Erro ao ${currentAction} vaga:`, error);
                            alert(`Erro ao ${currentAction} vaga.`);
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
                modalMessage.textContent = "Tem certeza que deseja excluir esta vaga? Esta ação não pode ser desfeita.";

                confirmBtn.dataset.spotId = spot.id;

                modalConfirm.classList.remove("hidden");
            } else {
                console.warn("Elemento(s) do modal de exclusão não encontrado(s). Usando confirmação padrão.");
                if (confirm("Tem certeza que deseja excluir esta vaga? Esta ação não pode ser desfeita.")) {
                    deleteSpot(spot.id)
                        .then(() => {
                            alert("Vaga excluída com sucesso!");
                            card.remove();
                            carregarMinhasVagas();
                        })
                        .catch(error => {
                            console.error("Erro ao excluir vaga:", error);
                            alert("Erro ao excluir vaga.");
                        });
                }
            }
        });
    }
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

// Atualiza os cards de vagas no mapa e na lista
export function openParkingDetailModal(spotDetails) {
    const modal = document.getElementById('parking-detail-modal');
    if (!modal) {
        console.error("Erro: Modal de detalhes da vaga (parking-detail-modal) não encontrado.");
        return;
    }

    modal.classList.remove('hidden');

    console.log("Spot Details completo recebido na função:", spotDetails);

    currentSpotDetails = spotDetails;
    currentSpotId = spotDetails.id;

    const modalParkingTitle = modal.querySelector('#modal-parking-title');
    const modalParkingAddress = modal.querySelector('#modal-parking-address');
    const modalParkingDescription = modal.querySelector('#modal-parking-description');
    const modalParkingType = modal.querySelector('#modal-parking-type');
    const modalParkingQuantity = modal.querySelector('#modal-parking-quantity');
    const modalSpotPriceHourElement = modal.querySelector('#modal-spot-price-hour');
    const modalSpotLocationElement = modal.querySelector('#modal-spot-location');
    const modalParkingImage = modal.querySelector('#modal-parking-image');
    
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
            time_24hr: true,   // Força o formato 24 horas
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

    const priceHour = parseFloat(spotDetails.price_hour);
    const priceHourFormatted = isNaN(priceHour) ? 'N/A' : priceHour.toFixed(2).replace('.', ',');

    if (modalParkingTitle) modalParkingTitle.textContent = spotDetails.title || '(Título não disponível)';
    if (modalParkingAddress) modalParkingAddress.textContent = spotDetails.address || '(Endereço não disponível)';

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
            initialSelectedDateStr = availableDates[0];
            // Pré-seleciona a primeira data no calendário Flatpickr visualmente.
            reservationCalendarInstance.setDate(initialSelectedDateStr, true);
        } else {
            // Se não há datas disponíveis, zera a calculadora
            updateReservationSummary(currentSpotDetails, null, null, null);
        }

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

    if (modalParkingTitle) modalParkingTitle.textContent = spotDetails.title || '(Título não disponível)';
    if (modalParkingAddress) modalParkingAddress.textContent = spotDetails.address || '(Endereço não disponível)';
    if (modalParkingDescription) modalParkingDescription.textContent = spotDetails.description || '(Descrição não disponível)';

    const formattedTipoVaga = formatarTipoVaga(spotDetails.tipo_vaga);
    if (modalParkingType) modalParkingType.textContent = `Tipo: ${formattedTipoVaga || 'Não informado'}`;

    if (modalParkingQuantity) modalParkingQuantity.textContent = `Vagas disponíveis: ${spotDetails.quantity || '1'}`;
    
    if (modalSpotPriceHourElement) modalSpotPriceHourElement.textContent = `Preço por hora: R$ ${priceHourFormatted}`;

    if (modalSpotLocationElement) {
        if (spotDetails.latitude && spotDetails.longitude) {
            modalSpotLocationElement.textContent = `Localização: Lat ${spotDetails.latitude}, Long ${spotDetails.longitude}`;
        } else {
            modalSpotLocationElement.textContent = `Localização: Não disponível`;
        }
    } else {
        console.warn("Elemento 'modal-spot-location' não encontrado. As coordenadas não serão exibidas.");
    }

    if (modalParkingImage) {
        if (spotDetails.photos && spotDetails.photos.length > 0 && spotDetails.photos[0].image) {
            modalParkingImage.src = spotDetails.photos[0].image;
        } else {
            modalParkingImage.src = '/static/parking/css/images/placeholder.png';
        }
        modalParkingImage.alt = spotDetails.description || spotDetails.title || 'Imagem da vaga';
    }
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
        const response = await fetch('/api/reservations/bulk_create/', { // ou o endpoint que você usa
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

// Função auxiliar para capitalizar a primeira letra do dia da semana (se não estiver em availability_manager.js)
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// --- Funções de Cálculo e Requisição de Reserva

function handleConfirmReservation(spotDetails) {
    // Lógica para confirmar a reserva
    console.log("Reserva confirmada para:", spotDetails);
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