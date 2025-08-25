
// Importa apenas as funções necessárias
import { handleDateSelection, updateReservationSummary } from './ui_handlers.js'; 

let reservationCalendarInstance = null;
let isProcessingDate = false;

export function initializeReservationComponents(modalElement, spotDetails) {
    // 1. Encontra os elementos dentro do modal, assim a função é reutilizável.
    const startTimeInput = modalElement.querySelector('#start-time-input');
    const endTimeInput = modalElement.querySelector('#end-time-input');
    const availabilityCalendar = modalElement.querySelector('#reservation-calendar');

    // Destrói instâncias existentes para evitar duplicação
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

    // --- LÓGICA DO SELETOR DE HORA (INÍCIO) ---
    if (startTimeInput) {
        flatpickr(startTimeInput, {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: true,
            minuteIncrement: 15,
            onReady: function(selectedDates, dateStr, instance) {
                if (!instance.input.value) {
                    instance.setDate("08:00", false); 
                }
            },
            onChange: function() {
                // Ao invés de usar variáveis globais, passamos a referência para o que precisamos
                const currentSelectedSlot = { date: reservationCalendarInstance.selectedDates[0] ? flatpickr.formatDate(reservationCalendarInstance.selectedDates[0], "Y-m-d") : null };
                updateReservationSummary(
                    spotDetails,
                    currentSelectedSlot.date,
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
                if (!instance.input.value) {
                    instance.setDate("18:00", false);
                }
            },
            onChange: function() {
                // Ao invés de usar variáveis globais, passamos a referência para o que precisamos
                const currentSelectedSlot = { date: reservationCalendarInstance.selectedDates[0] ? flatpickr.formatDate(reservationCalendarInstance.selectedDates[0], "Y-m-d") : null };
                updateReservationSummary(
                    spotDetails,
                    currentSelectedSlot.date, 
                    startTimeInput ? startTimeInput.value : null,
                    endTimeInput.value
                );
            }
        });
    }

    // --- LÓGICA DO CALENDÁRIO DE DATAS ---
    let availabilityArray = [];
    if (spotDetails && Array.isArray(spotDetails.dates_availability)) {
        availabilityArray = spotDetails.dates_availability;
    } 
    else if (spotDetails && spotDetails.dates_availability && Array.isArray(spotDetails.dates_availability.dates_availability)) {
        availabilityArray = spotDetails.dates_availability.dates_availability;
    }
    else if (spotDetails && Array.isArray(spotDetails.availabilities_by_date)) {
        availabilityArray = spotDetails.availabilities_by_date;
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
                    return;
                }
                const selectedDatesDisplay = modalElement.querySelector('#selected-reservation-dates-display');
                const availableSlotsForDateContainer = modalElement.querySelector('#available-slots-for-date');
                const noSlotsMessage = modalElement.querySelector('#no-slots-message');

                if (selectedDates && selectedDates.length > 0) {
                    isProcessingDate = true;
                    const spotId = document.getElementById('reservation-spot-id').value;
                    
                    if (spotId) {
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
                } else {
                    document.getElementById('dynamic-vaga-squares').innerHTML = '';
                    document.getElementById('reserved-slots-list').innerHTML = '';
                    document.getElementById('reserved-slots-for-date').classList.add('hidden');
                    
                    if (noSlotsMessage) {
                        noSlotsMessage.textContent = 'Selecione uma data para ver as vagas disponíveis.';
                        noSlotsMessage.classList.remove('hidden');
                    }

                    updateReservationSummary(spotDetails, null, null, null); 
                }
            }
        });
    }

    // Reinicializa o estado inicial do modal
    if (availableDates.length > 0) {
        reservationCalendarInstance.clear();
        updateReservationSummary(spotDetails, null, null, null);
    }
    if (startTimeInput) startTimeInput.value = "";
    if (endTimeInput) endTimeInput.value = "";
}