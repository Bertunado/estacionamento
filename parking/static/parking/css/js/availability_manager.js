// Controle da interface e coleta de dados para a disponibilidade das vagas.
let flatpickrInstance; // Para a instância do Flatpickr
let selectedDatesConfigDiv; 
let selectedAvailabilities = {}; // Armazena as disponibilidades configuradas pelo publicador
let noDatesMessage;

function updateSelectedDatesConfig(dates) {
    // Limpa o conteúdo anterior, mas mantém a mensagem oculta se já estiver
    selectedDatesConfigDiv.innerHTML = '';
    noDatesMessage.classList.add('hidden'); // Sempre oculta a mensagem ao renderizar

    if (dates.length === 0) {
        noDatesMessage.classList.remove('hidden'); // Mostra a mensagem se não houver datas
        selectedDatesConfigDiv.appendChild(noDatesMessage);
        selectedAvailabilities = {}; // Limpa as disponibilidades se não houver datas
        return;
    }

    // Adiciona o cabeçalho
    const header = document.createElement('div');
    header.classList.add('grid', 'grid-cols-3', 'gap-4', 'font-bold', 'mb-2');
    header.innerHTML = `
        <div>Dia</div>
        <div>Horários Disponíveis</div>
        <div>Quantidade de Vagas</div>
    `;
    selectedDatesConfigDiv.appendChild(header);

    // Ordena as datas para que fiquem em ordem cronológica
    dates.sort((a, b) => a.getTime() - b.getTime()).forEach(date => {
        const dayOfWeek = new Date(date).toLocaleDateString('pt-BR', { weekday: 'long' });
        // Formata a data para 'DD/MM/YYYY' para exibição e para usar como chave
        const formattedDate = new Date(date).toLocaleDateString('pt-BR');
        // Formato 'YYYY-MM-DD' para o backend, ideal para o 'available_date' no objeto de dados
         const backendFormattedDate = new Date(date).toISOString().split('T')[0];

        // Cria a linha da data com inputs
        const dateRow = document.createElement('div');
        // Adiciona uma classe para facilitar a identificação no listener e o data-date
        dateRow.classList.add('grid', 'grid-cols-3', 'gap-4', 'items-center', 'py-2', 'border-t', 'border-gray-200', 'availability-date-row');
        dateRow.dataset.date = backendFormattedDate; // Armazena a data no formato do backend para fácil acesso
        
        const existingData = selectedAvailabilities[backendFormattedDate] || {};
        const currentQuantity = existingData.available_quantity || 1;
        
        let initialTime = '';
        let finalTime = '';

       // Tenta preencher os campos se já houver um valor em available_times
        if (existingData.available_times) {
            const parts = existingData.available_times.split(' às ');
            if (parts.length === 2) {
                initialTime = parts[0].trim();
                finalTime = parts[1].trim();
            } else {
                // Se não estiver no formato esperado, usa o valor como inicial (ou limpa)
                initialTime = existingData.available_times.trim();
            }
        }


         // Gerar as opções do dropdown para quantidade
        let quantityOptionsHtml = '';
        for (let i = 1; i <= 5; i++) {
            // Seleciona a opção correta se já houver um valor
            const selectedAttribute = (i === currentQuantity) ? 'selected' : '';
            quantityOptionsHtml += `<option value="${i}" ${selectedAttribute}>${i}</option>`;
        }

        dateRow.innerHTML = `
    <div class="text-gray-700 col-span-1">${formattedDate} - ${capitalizeFirstLetter(dayOfWeek)}</div>
    <div class="col-span-2"> <div class="flex items-center space-x-2">

            <input type="time"
                   name="availability_start_time_${backendFormattedDate}"
                   class="w-full sm:w-1/2 border border-gray-300 rounded px-2 py-1 text-sm time-input"
                   value="${initialTime}">
            <span class="text-gray-600 font-semibold flex-shrink-0">às</span>

            <input type="time"
                   name="availability_end_time_${backendFormattedDate}"
                   class="w-full sm:w-1/2 border border-gray-300 rounded px-2 py-1 text-sm time-input"
                   value="${finalTime}">
        </div>
        </div>
    <div class="col-span-1"> <select name="availability_quantity_${backendFormattedDate}"
                class="w-full sm:w-1/2 border border-gray-300 rounded px-2 py-1 text-sm quantity-input">
            ${quantityOptionsHtml}
        </select>
    </div>
`;
selectedDatesConfigDiv.appendChild(dateRow);
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

    // Se já houver uma instância do Flatpickr, destrua-a antes de criar uma nova.
    if (availabilityCalendar._flatpickr) {
        availabilityCalendar._flatpickr.destroy();
    }

    // Inicializa o calendário com Flatpickr
    flatpickrInstance = flatpickr(availabilityCalendar, {
        mode: "multiple", // Permite selecionar múltiplas datas
        dateFormat: "d/m/Y", // Formato para exibição
        locale: flatpickr.l10ns.pt, // Usa o locale pt.js carregado globalmente
        onChange: function(selectedDates, dateStr, instance) {
            updateSelectedDatesConfig(selectedDates);
        }
    });

    // Listener para capturar mudanças nos inputs de hora/quantidade
    selectedDatesConfigDiv.addEventListener('change', (e) => {
        if (e.target.classList.contains('time-range-input') || e.target.classList.contains('quantity-input')) {
            const dateRowContainer = e.target.closest('.availability-date-row');

            if (!dateRowContainer) {
                console.warn("availability_manager.js: Contêiner da linha de data (availability-date-row) não encontrado para o input.");
                return;
            }

            const dateKey = dateRowContainer.dataset.date;

            if (!selectedAvailabilities[dateKey]) {
                selectedAvailabilities[dateKey] = {
                    available_date: dateKey,
                    available_times: '',
                    available_quantity: 1
                };
            }

            if (e.target.classList.contains('time-range-input')) {
                selectedAvailabilities[dateKey].available_times = e.target.value;
            } else if (e.target.classList.contains('quantity-input')) {
                selectedAvailabilities[dateKey].available_quantity = parseInt(e.target.value);
            }

            console.log(`Disponibilidade atualizada para ${dateKey}:`, selectedAvailabilities[dateKey]);
        }
    });

    console.log("availability_manager.js: Setup de campos de disponibilidade concluído.");
}

// Função para obter os dados de disponibilidade para envio ao backend, exportada.
export function getSelectedAvailabilities() {
    return selectedAvailabilities;
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

export function coletarDisponibilidades() {
    const finalAvailabilities = {};
    if (flatpickrInstance) {
        flatpickrInstance.selectedDates.forEach(date => {
            const dateStr = flatpickr.formatDate(date, "Y-m-d");
            if (selectedAvailabilities[dateStr]) {
                // Se o usuário selecionou uma data e configurou seus horários, inclua-a.
                finalAvailabilities[dateStr] = selectedAvailabilities[dateStr];
            } else {
                console.warn(`coletarDisponibilidades: Data ${dateStr} selecionada, mas sem configurações de horário/quantidade. Usando padrões ou ignorando.`);
                finalAvailabilities[dateStr] = {
                    available_date: dateStr,
                    start_time: "08:00", // Padrão
                    end_time: "18:00",   // Padrão
                    available_quantity: 1 // Padrão
                };
            }
        });
    } else {
        console.warn("coletarDisponibilidades: flatpickrInstance não está inicializado. Retornando array vazio.");
        return [];
    }

    // Filtra para retornar apenas as disponibilidades com quantidade > 0 (se 0 significa indisponível)
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