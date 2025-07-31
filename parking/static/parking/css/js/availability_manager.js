// Controle da interface e coleta de dados para a disponibilidade das vagas.
let flatpickrInstance = null; // Para a instância do Flatpickr
let selectedDatesConfigDiv; 
let selectedAvailabilities = {}; // Armazena as disponibilidades configuradas pelo publicador
let noDatesMessage;

// Gerenciar a seleção de datas e disponibilidades para a publicação de vagas
function updateSelectedDatesConfig(dates) {
    selectedDatesConfigDiv.innerHTML = '';
    noDatesMessage.classList.add('hidden');

    if (dates.length === 0) {
        noDatesMessage.classList.remove('hidden');
        selectedDatesConfigDiv.appendChild(noDatesMessage);
        selectedAvailabilities = {};
        return;
    }

    const header = document.createElement('div');
    header.classList.add('grid', 'grid-cols-3', 'gap-4', 'font-bold', 'mb-2');
    header.innerHTML = `
        <div>Dia</div>
        <div>Horários Disponíveis</div>
        <div>Quantidade de Vagas</div>
    `;
    selectedDatesConfigDiv.appendChild(header);

    dates.sort((a, b) => a.getTime() - b.getTime()).forEach(date => {
        const dayOfWeek = new Date(date).toLocaleDateString('pt-BR', { weekday: 'long' });
        const formattedDate = new Date(date).toLocaleDateString('pt-BR');
        const backendFormattedDate = new Date(date).toISOString().split('T')[0];

        const dateRow = document.createElement('div');
        dateRow.classList.add('grid', 'grid-cols-3', 'gap-4', 'items-center', 'py-2', 'border-t', 'border-gray-200', 'availability-date-row');
        dateRow.dataset.date = backendFormattedDate;

        const existingData = selectedAvailabilities[backendFormattedDate] || {};
        const currentQuantity = existingData.available_quantity || 1;
        const initialTime = existingData.start_time || '08:00';
        const finalTime = existingData.end_time || '18:00';

        let quantityOptionsHtml = '';
        for (let i = 1; i <= 5; i++) {
            const selectedAttribute = (i === currentQuantity) ? 'selected' : '';
            quantityOptionsHtml += `<option value="${i}" ${selectedAttribute}>${i}</option>`;
        }

        dateRow.innerHTML = `
            <div class="text-gray-700 col-span-1">${formattedDate} - ${capitalizeFirstLetter(dayOfWeek)}</div>
            <div class="col-span-1">
                <div class="flex items-center gap-2">
                    <input type="text"
                           id="start-time-${backendFormattedDate}"
                           name="availability_start_time_${backendFormattedDate}"
                           class="w-24 border border-gray-300 rounded px-2 py-1 text-sm time-input"
                           value="${initialTime}" placeholder="HH:MM">
                    <span class="text-gray-600 font-semibold">às</span>
                    <input type="text"
                           id="end-time-${backendFormattedDate}"
                           name="availability_end_time_${backendFormattedDate}"
                           class="w-24 border border-gray-300 rounded px-2 py-1 text-sm time-input"
                           value="${finalTime}" placeholder="HH:MM">
                </div>
            </div>
            <div class="col-span-1">
                <select name="availability_quantity_${backendFormattedDate}"
                        class="w-full border border-gray-300 rounded px-2 py-1 text-sm quantity-select">
                    ${quantityOptionsHtml}
                </select>
            </div>
        `;
        selectedDatesConfigDiv.appendChild(dateRow);

        const startTimeInput = dateRow.querySelector(`#start-time-${backendFormattedDate}`);
        const endTimeInput = dateRow.querySelector(`#end-time-${backendFormattedDate}`);
        const quantitySelect = dateRow.querySelector(`select[name="availability_quantity_${backendFormattedDate}"]`);

        // Flatpickr para o input de hora de início
        flatpickr(startTimeInput, {
            enableTime: true, // Habilita o seletor de tempo
            noCalendar: true, // Desabilita o calendário
            dateFormat: "H:i", // Formato 24 horas (HH:MM)
            time_24hr: true,   // Força o formato 24 horas
            minuteIncrement: 15, // incrementos de 15 minutos
            defaultDate: initialTime // Define o valor inicial
        });

        // Flatpickr para o input de hora de fim
        flatpickr(endTimeInput, {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: true,
            minuteIncrement: 15,
            defaultDate: finalTime
        });

        // 2. Inicializar selectedAvailabilities para esta data, se ainda não existir
        if (!selectedAvailabilities[backendFormattedDate]) {
            selectedAvailabilities[backendFormattedDate] = {
                available_date: backendFormattedDate,
                start_time: startTimeInput ? startTimeInput.value : '08:00',
                end_time: endTimeInput ? endTimeInput.value : '18:00',
                available_quantity: quantitySelect ? parseInt(quantitySelect.value) : 1
            };
        } else {
            selectedAvailabilities[backendFormattedDate].available_date = backendFormattedDate;
            selectedAvailabilities[backendFormattedDate].start_time = startTimeInput ? startTimeInput.value : '08:00';
            selectedAvailabilities[backendFormattedDate].end_time = endTimeInput ? endTimeInput.value : '18:00';
            selectedAvailabilities[backendFormattedDate].available_quantity = quantitySelect ? parseInt(quantitySelect.value) : 1;
        }

        // 3. Adicionar Listeners de Evento para o campo de quantidade
        if (quantitySelect) {
            quantitySelect.addEventListener('change', (e) => {
                selectedAvailabilities[backendFormattedDate].available_quantity = parseInt(e.target.value);
                console.log(`[Debug] Quantidade para ${backendFormattedDate} atualizada para:`, selectedAvailabilities[backendFormattedDate].available_quantity);
            });
        }

        // 4. Adicionar Listeners de Evento para os campos de hora (início e fim)
        if (startTimeInput) {
            startTimeInput.addEventListener('change', (e) => {
                selectedAvailabilities[backendFormattedDate].start_time = e.target.value;
                console.log(`[Debug] Hora de início para ${backendFormattedDate} atualizada para:`, selectedAvailabilities[backendFormattedDate].start_time);
            });
        }

        if (endTimeInput) {
            endTimeInput.addEventListener('change', (e) => {
                selectedAvailabilities[backendFormattedDate].end_time = e.target.value;
                console.log(`[Debug] Hora final para ${backendFormattedDate} atualizada para:`, selectedAvailabilities[backendFormattedDate].end_time);
            });
        }
    });
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

export function setupAvailabilityFields() {
    console.log("availability_manager.js: Configurando campos de disponibilidade...");

    selectedDatesConfigDiv = document.getElementById('selected-dates-config');
    noDatesMessage = document.getElementById('no-dates-message');
    const availabilityCalendar = document.getElementById('availability-calendar');

    if (!selectedDatesConfigDiv || !noDatesMessage || !availabilityCalendar) {
        console.error("availability_manager.js: Um ou mais elementos do calendário/configuração não foram encontrados. Abortando setup.");
        return;
    }

    console.log("availability_manager.js: Elementos de disponibilidade encontrados. Configurando Flatpickr e listeners.");

    if (availabilityCalendar._flatpickr) {
        availabilityCalendar._flatpickr.destroy();
    }

    flatpickrInstance = flatpickr(availabilityCalendar, {
        mode: "multiple",
        dateFormat: "d/m/Y",
        locale: flatpickr.l10ns.pt,
        minDate: "today",
        onChange: function(selectedDates, dateStr, instance) {
            updateSelectedDatesConfig(selectedDates);
        }
    });

    selectedDatesConfigDiv.addEventListener('change', (e) => {
        if (e.target.classList.contains('quantity-select')) { // Apenas para quantity-select agora
            const dateRowContainer = e.target.closest('.availability-date-row');
            if (dateRowContainer) {
                const dateKey = dateRowContainer.dataset.date;
                if (selectedAvailabilities[dateKey]) {
                    selectedAvailabilities[dateKey].available_quantity = parseInt(e.target.value);
                    console.log(`Disponibilidade atualizada para ${dateKey}:`, selectedAvailabilities[dateKey]);
                }
            }
        }
    });

    console.log("availability_manager.js: Setup de campos de disponibilidade concluído.");
}

export function loadAvailabilitiesForEdit(spot) {
    if (spot && spot.availabilities_by_date) {
        const datesToSelect = [];
        spot.availabilities_by_date.forEach(avail => {
            datesToSelect.push(avail.available_date);
            selectedAvailabilities[avail.available_date] = {
                available_date: avail.available_date,
                start_time: avail.start_time,
                end_time: avail.end_time,
                available_quantity: avail.available_quantity
            };
        });
        
        if (flatpickrInstance) {
            flatpickrInstance.setDate(datesToSelect, true); // Seta as datas no calendário
            updateSelectedDatesConfig(flatpickrInstance.selectedDates); // Força a atualização da interface
        } else {
            console.warn("loadAvailabilitiesForEdit: flatpickrInstance não está inicializado.");
        }
    }
}

export function getSelectedAvailabilities() {
    return Object.values(selectedAvailabilities).filter(avail => avail.available_quantity > 0);
}

export function coletarDisponibilidades() {
    const finalAvailabilities = {};
    if (flatpickrInstance) {
        flatpickrInstance.selectedDates.forEach(date => {
            const dateStr = flatpickr.formatDate(date, "Y-m-d");
            if (selectedAvailabilities[dateStr]) {
                finalAvailabilities[dateStr] = selectedAvailabilities[dateStr];
            } else {
                console.warn(`coletarDisponibilidades: Data ${dateStr} selecionada, mas sem configurações de horário/quantidade. Usando padrões ou ignorando.`);
                finalAvailabilities[dateStr] = {
                    available_date: dateStr,
                    start_time: "08:00",
                    end_time: "18:00",
                    available_quantity: 1
                };
            }
        });
    } else {
        console.warn("coletarDisponibilidades: flatpickrInstance não está inicializado. Retornando array vazio.");
        return [];
    }

    return Object.values(finalAvailabilities).filter(avail => avail.available_quantity > 0);
}

export function formatarTipoVaga(tipo) {
    const tipos = {
        rua_coberta: "Rua (Coberta)",
        rua_descoberta: "Rua (Descoberta)",
        garagem: "Garagem",
        predio_coberta: "Prédio (Coberta)",
        predio_descoberta: "Prédio (Descoberta)",
    };
    return tipos[tipo] || "Tipo desconhecido";
}