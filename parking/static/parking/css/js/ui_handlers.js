// ui_handlers.js
// Funções responsáveis por renderizar elementos na interface e gerenciar modais/abas

import { getReservationRequests, updateReservationStatus, fetchMySpots, fetchSpots, deleteSpot, updateSpotStatus, createReservation, fetchMyReservations, fetchSpotReservations } from './api_services.js';
import { initializeAutocomplete, configurarBuscaEndereco, initMap, map, carregarSpots as carregarSpotsDoMapa } from './map_utilities.js';
import { getCookie } from './utils.js';
import { setupAvailabilityFields } from './availability_manager.js';
import { createMiniMap } from './map_utilities.js'; 
import { loadConversations } from './chat_loader.js';
import { getAuthToken, getCsrfToken, loadAndRenderMyReservations } from './api_services.js';
import { showToast } from './chat_loader.js'; 
import { showConfirmModal } from './confirmations.js';
import { initializeReservationComponents } from './calendar.js';
import { formatarTamanhoVaga, formatarTipoVaga, formatarHorarioDisponivelModal, formatDateToISO  } from './format.js';
import { favoritedSpotIds, saveFavoritesToStorage } from './globals.js';

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

export async function activateTab(tabName) {
    console.log(`activateTab: Ativando aba '${tabName}'`);

    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const mobileNavButtons = document.querySelectorAll('#mobile-nav button');

    // 1. Desativa todos os botões (desktop e móvel)
    tabButtons.forEach(button => {
        button.classList.remove('border-indigo-600', 'text-indigo-600');
        button.classList.add('border-gray-200', 'text-gray-500', 'hover:text-indigo-500');
    });
    
    mobileNavButtons.forEach(button => {
        button.classList.remove('text-indigo-600'); // Remove a cor ativa
        button.classList.add('text-gray-500');
    });

    // 2. Esconde todos os conteúdos
    tabContents.forEach(content => {
        content.classList.remove('active', 'flex');
        content.classList.add('hidden');
    });

    // 3. Ativa a aba e o botão corretos (desktop)
    const desktopBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (desktopBtn) {
        desktopBtn.classList.add('border-indigo-600', 'text-indigo-600');
        desktopBtn.classList.remove('border-gray-200', 'text-gray-500', 'hover:text-indigo-500');
    }
    
    // 4. Ativa o ícone correto (móvel)
    const mobileBtn = document.querySelector(`.mobile-nav-btn[data-tab="${tabName}"]`);
    if (mobileBtn) {
        mobileBtn.classList.add('text-indigo-600'); // Adiciona a cor ativa
        mobileBtn.classList.remove('text-gray-500');
    }

    // 5. Mostra o conteúdo da aba
    const contentToShow = document.getElementById(tabName);
    if (contentToShow) {
        contentToShow.classList.add('active');
        contentToShow.classList.remove('hidden');
        if (contentToShow.dataset.displayFlex === 'true') {
            contentToShow.classList.add('flex');
        }
    }

    // --- 👇 ESTA É A LÓGICA NOVA E CORRIGIDA 👇 ---
    
    if (tabName === 'parkings') {
        console.log("activateTab: Aba 'parkings' ativada.");

        // Detecta se estamos no desktop (breakpoint 'md' do Tailwind é 768px)
        const isMobile = window.innerWidth < 768; 

        // Define os IDs corretos para celular ou desktop
        const mapId = isMobile ? 'map' : 'mapDesktop';
        const inputId = isMobile ? 'cepInput' : 'cepInputDesktop';

        // Inicializa o mapa correto
        // NOTA: Isso assume que seu 'initMap' foi atualizado (veja Passo 2)
        await initMap(mapId); 

        setTimeout(() => {
            if (map && window.google && window.google.maps) {
                google.maps.event.trigger(map, 'resize');
                map.setCenter(map.getCenter());
                
                // Carrega os spots em AMBAS as listas
                carregarSpotsDaListaEdoMapa(); 
                
                // Configura a busca de endereço correta
                // NOTA: Isso assume que 'configurarBuscaEndereco' foi atualizada (veja Passo 2)
                configurarBuscaEndereco(inputId);
                
                // Adiciona o listener de clique do mapa apenas no celular
                if (isMobile) {
                    map.addListener('click', () => {
                        const sheet = document.getElementById('parking-sheet');
                        if (sheet.classList.contains('is-open')) {
                            toggleParkingSheet();
                        }
                    });
                }

            } else {
                console.warn("activateTab: Mapa ou libs não disponíveis.");
            }
        }, 100);

    } else if (tabName === 'my-parkings') {
        carregarMinhasVagas();
    } else if (tabName === 'my-reservations') {
        carregarMinhasReservas(); 
    } else if (tabName === 'requests') {
        await loadReservationRequests();
    } else if (tabName === "add-parking") {
        console.log("activateTab: Aba 'add-parking' ativada.");
        setTimeout(() => {
            initializeAutocomplete();
            setupAvailabilityFields(); 
            console.log("setupAvailabilityFields() chamado ao ativar a aba 'add-parking'.");
        }, 100);
    }
}

export function openFavoritesModal(spot) {
    const modal = document.getElementById('favorites-modal');
    if (!modal) return;

    modal.dataset.currentSpotId = spot.id;
    renderFavoriteListsInModal(spot.id);
    modal.classList.remove('hidden');
}

// Desenha os quadrados das listas dentro do modal
function renderFavoriteListsInModal(spotId) {
    const container = document.getElementById('favorites-list-container');
    if (!container) return;
    container.innerHTML = '';

    favoriteLists.forEach(list => {
        // Verifica se a vaga já está NESTA lista
        const isSaved = list.spots.includes(String(spotId)) || list.spots.includes(parseInt(spotId));
        
        const card = document.createElement('div');
        card.className = "cursor-pointer group relative";
        card.onclick = () => toggleSpotInList(list.id, spotId);

        // Placeholder de imagem (pode melhorar isso depois pegando a foto da 1ª vaga)
        const coverImage = isSaved 
            ? `<div class="w-full h-full bg-indigo-100 flex items-center justify-center text-indigo-500"><i class="fas fa-check text-3xl"></i></div>`
            : `<div class="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300 group-hover:bg-gray-200"><i class="fas fa-heart text-3xl"></i></div>`;

        card.innerHTML = `
            <div class="aspect-square rounded-xl overflow-hidden border border-gray-200 shadow-sm mb-2 transition-transform transform group-hover:scale-105">
                ${coverImage}
            </div>
            <h4 class="text-sm font-bold text-gray-800 truncate">${list.name}</h4>
            <p class="text-xs text-gray-500">${list.spots.length} vaga(s)</p>
        `;
        container.appendChild(card);
    });
}

// Salva ou remove a vaga da lista clicada
function toggleSpotInList(listId, spotId) {
    const list = favoriteLists.find(l => l.id === listId);
    if (!list) return;

    const idStr = String(spotId);
    const index = list.spots.indexOf(idStr);

    if (index > -1) {
        list.spots.splice(index, 1); // Remove
    } else {
        list.spots.push(idStr); // Adiciona
        // Fecha o modal ao salvar (opcional, estilo Airbnb)
        document.getElementById('favorites-modal').classList.add('hidden');
    }
    
    saveListsToStorage();
    updateAllHeartIcons(spotId); // Atualiza os corações na tela principal
    renderFavoriteListsInModal(spotId); // Atualiza o modal se ele continuar aberto
}

// Cria uma nova lista
export function setupFavoritesLogic() {
    document.getElementById("create-fav-list-btn")?.addEventListener("click", () => {
        const name = prompt("Nome da nova lista:");
        if (name) {
            favoriteLists.push({ id: Date.now().toString(), name: name, spots: [] });
            saveListsToStorage();
            // Atualiza o modal
            const modal = document.getElementById('favorites-modal');
            if (modal && !modal.classList.contains('hidden')) {
                renderFavoriteListsInModal(modal.dataset.currentSpotId);
            }
        }
    });

    document.getElementById("close-favorites-modal")?.addEventListener("click", () => {
        document.getElementById("favorites-modal").classList.add("hidden");
    });
}

// Atualiza a cor do coração na tela principal
export function updateAllHeartIcons(spotId) {
    const isFav = isSpotFavorited(spotId);
    const btns = document.querySelectorAll(`.btn-favorite[data-spot-id="${spotId}"] i`);
    btns.forEach(icon => {
        icon.className = isFav ? "fas fa-heart text-red-500 text-lg" : "far fa-heart text-gray-400 text-lg";
    });
}

export function toggleParkingSheet() {
    const sheet = document.getElementById('parking-sheet');
    const sheetTitle = document.getElementById('sheet-title');
    
    if (sheet) {
        sheet.classList.toggle('is-open');

        // Opcional: Muda o texto do puxador
        if (sheet.classList.contains('is-open')) {
            sheetTitle.textContent = "Toque no mapa para fechar";
        } else {
            sheetTitle.textContent = "Vagas Próximas";
        }
    }
}

export function renderProfileFavorites() {
    const container = document.getElementById('profile-favorites-container'); // Você precisará criar este DIV no seu home.html dentro da aba de perfil
    if (!container) return;

    container.innerHTML = '';
    
    if (favoriteLists.length === 0) {
        container.innerHTML = '<p class="text-gray-500">Você ainda não tem listas de favoritos.</p>';
        return;
    }

    favoriteLists.forEach(list => {
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex items-center space-x-4 cursor-pointer hover:shadow-md transition-shadow";
        
        card.innerHTML = `
            <div class="w-16 h-16 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500">
                <i class="fas fa-heart text-2xl"></i>
            </div>
            <div>
                <h4 class="font-bold text-gray-800">${list.name}</h4>
                <p class="text-sm text-gray-500">${list.spots.length} vaga(s) salva(s)</p>
            </div>
        `;
        
        // Ao clicar, poderia abrir uma lista com as vagas (futuro)
        card.onclick = () => alert(`Abrir lista: ${list.name} (Implementar visualização de vagas)`);
        
        container.appendChild(card);
    });
}

async function loadReservationRequests() {
    const requestsContainer = document.getElementById('requestsContainer');
    const noRequestsMessage = document.getElementById('no-requests-message');
    const badge = document.getElementById('requests-count-badge'); // O <span> no botão da aba

    if (!requestsContainer) return; // Sai se o elemento não existir

    try {
        const requests = await getReservationRequests(); // Chama a API
        requestsContainer.innerHTML = ''; // Limpa o contêiner

        if (requests.length === 0) {
            noRequestsMessage?.classList.remove('hidden');
            badge?.classList.add('hidden');
            badge.textContent = '0';
        } else {
            noRequestsMessage?.classList.add('hidden');
            
            // Atualiza o contador
            badge.textContent = requests.length;
            badge?.classList.remove('hidden');

            requests.forEach(request => {
                const card = createRequestCard(request); // Cria o card
                requestsContainer.appendChild(card);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar solicitações:', error);
        // showToast('Erro ao carregar solicitações.', 'error');
        alert('Erro ao carregar solicitações.');
    }
}

/**
 * Cria o elemento HTML para um card de solicitação de reserva.
 */
function createRequestCard(request) {
    const card = document.createElement('div');
    card.className = 'border border-gray-200 rounded-lg p-4 shadow-sm';
    card.id = `request-${request.id}`; // ID para remoção fácil

    // Formata datas (você pode ter isso no seu 'format.js')
    const startDate = new Date(request.start_time).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const endDate = new Date(request.end_time).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    
    // Pega o nome do locatário
    const renterName = request.renter?.perfil?.nome_completo || request.renter?.email || 'Usuário';

    card.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h3 class="text-lg font-semibold text-indigo-700">${request.spot.title}</h3>
            <span class="text-lg font-bold">R$ ${request.total_price}</span>
        </div>
        <p class="text-gray-600"><strong>Locatário:</strong> ${renterName}</p>
        <p class="text-gray-600"><strong>Período:</strong> ${startDate} até ${endDate}</p>
        <p class="text-gray-600"><strong>Slot:</strong> Vaga ${request.slot_number}</p>
        
        <div class="flex space-x-4 mt-4">
            <button data-id="${request.id}" data-action="approve" class="action-btn flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition duration-200">
                Aprovar
            </button>
            <button data-id="${request.id}" data-action="refuse" class="action-btn flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition duration-200">
                Recusar
            </button>
        </div>
    `;
    return card;
}

export async function handleReservationAction(id, action) {
    try {
        const result = await updateReservationStatus(id, action); // Chama a API
        
        // Remove o card da lista de pendentes
        const card = document.getElementById(`request-${id}`);
        if (card) {
            card.classList.add('opacity-0', 'transition-all'); // Efeito de fade out
            setTimeout(() => card.remove(), 500);
        }
        
        // showToast(`Reserva ${action === 'approve' ? 'Aprovada' : 'Recusada'}!`, 'success');
        alert(`Reserva ${action === 'approve' ? 'Aprovada' : 'Recusada'}!`);
        
        // Recarrega a lista para atualizar o contador da badge
        await loadReservationRequests();

    } catch (error) {
        console.error(`Erro ao ${action} reserva:`, error);
        const errorMessage = error.detail || `Falha ao ${action === 'approve' ? 'aprovar' : 'recusar'} reserva.`;
        // showToast(errorMessage, 'error');
        alert(errorMessage);
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
    try {
        const spots = await fetchSpots();
        window.allSpots = spots; 

        // Encontra OS DOIS contêineres de lista
        const listMobile = document.getElementById("parking");
        const listDesktop = document.getElementById("parkingDesktop");
        
        // Itera sobre os dois contêineres
        [listMobile, listDesktop].forEach(list => {
            if (list) {
                list.innerHTML = ""; // Limpa a lista
                if (spots && spots.length > 0) {
                    spots.forEach(spot => {
                        // Passa o ID da lista (parking ou parkingDesktop) para o renderSpot
                        renderSpot(spot, list.id); 
                    });
                } else {
                    list.innerHTML = `<p class="text-center text-gray-400 mt-6">Nenhuma vaga disponível.</p>`;
                }
            }
        });
        
        await carregarSpotsDoMapa(spots); // Carrega os marcadores no mapa

    } catch (error) {
        console.error("Erro ao carregar spots na UI:", error);
    }
}

export function renderSpot(spot, listId) {
    if (!spot || !spot.id) return;
    const list = document.getElementById(listId);
    if (!list) return;

    const card = document.createElement("div");
    card.className = "border border-gray-200 rounded-lg p-3 hover:bg-gray-50 mb-2 cursor-pointer relative group";
    card.setAttribute("data-spot-id", spot.id);

    const formattedTipoVaga = formatarTipoVaga(spot.tipo_vaga);
    const formattedTamanhoVaga = formatarTamanhoVaga(spot.size);
    
    // 1. Verifica se já é favorito na nossa lista global
    const isFav = favoritedSpotIds.has(spot.id);
    // Define as classes iniciais (Vermelho Sólido ou Cinza Outline)
    const heartClass = isFav ? "fas fa-heart text-red-500" : "far fa-heart text-gray-400";

    const photos = (spot.photos && spot.photos.length > 0) ? spot.photos : ['/static/parking/css/images/placeholder.png'];

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

        <div class="mt-2 relative w-full h-48 rounded overflow-hidden group/carousel">
            <img
                src="${photos[0]}"
                alt="${spot.description || spot.title}"
                class="w-full h-full object-cover carousel-image transition-opacity duration-300"
                data-current-index="0"
                onerror="this.onerror=null;this.src='/static/parking/css/images/placeholder.png';"
            />
            
            ${photos.length > 1 ? `
                <button class="carousel-prev absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 rounded-full p-1.5 shadow-md opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10 hover:scale-110">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <button class="carousel-next absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 rounded-full p-1.5 shadow-md opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10 hover:scale-110">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
                <div class="absolute bottom-2 left-0 right-0 flex justify-center space-x-1.5 z-10 pointer-events-none">
                    ${photos.map((_, idx) => `
                        <div class="w-1.5 h-1.5 rounded-full shadow-sm transition-colors duration-200 ${idx === 0 ? 'bg-white' : 'bg-white/50'} carousel-dot" data-idx="${idx}"></div>
                    `).join('')}
                </div>
            ` : ''}
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

    const favBtn = card.querySelector(".btn-favorite");
    if (favBtn) {
        favBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            
            openFavoritesModal(spot);
        });
    }

    const reservarBtn = card.querySelector(".btn-reservar");
    if (reservarBtn) {
        reservarBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            console.log("Clique no botão 'Reservar'. Abrindo modal de detalhes.");
            openParkingDetailModal(spot);
        });
    }

    if (photos.length > 1) {
        const imgElement = card.querySelector('.carousel-image');
        const prevBtn = card.querySelector('.carousel-prev');
        const nextBtn = card.querySelector('.carousel-next');
        const dots = card.querySelectorAll('.carousel-dot');

        const updateImage = (newIndex) => {
            imgElement.src = photos[newIndex];
            imgElement.dataset.currentIndex = newIndex;
            dots.forEach((dot, idx) => {
                if (idx === newIndex) {
                    dot.classList.remove('bg-white/50');
                    dot.classList.add('bg-white');
                } else {
                    dot.classList.add('bg-white/50');
                    dot.classList.remove('bg-white');
                }
            });
        };

        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            let idx = parseInt(imgElement.dataset.currentIndex);
            idx = (idx - 1 + photos.length) % photos.length;
            updateImage(idx);
        });

        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            let idx = parseInt(imgElement.dataset.currentIndex);
            idx = (idx + 1) % photos.length;
            updateImage(idx);
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

            const startDateTimeUTC = new Date(`${selectedDateStr}T${time.start}:00Z`);
            const endDateTimeUTC = new Date(`${selectedDateStr}T${time.end}:00Z`);
            
            // Verifica se a conversão foi bem-sucedida
            if (isNaN(startDateTimeUTC) || isNaN(endDateTimeUTC)) {
                timeItem.textContent = `Horário inválido: Das ${time.start} às ${time.end}`;
            } else {
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

    await renderVagaSquares(selectedDates);
}

function isTimeOverlap(userStart, userEnd, occupiedTimes, slotDate) {
    for (const time of occupiedTimes) {
        const occupiedStartUTC = new Date(`${slotDate}T${time.start}:00Z`);
        const occupiedEndUTC = new Date(`${slotDate}T${time.end}:00Z`);
        
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

    loadConversations();

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

// Calculadora que atualiza os valores da reserva no card do modal
export function updateReservationSummary(spotDetails, selectedSlotDate, startTime, endTime) {
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

    // LÓGICA DA CALCULADORA "POR HORA" 
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

    // LÓGICA DA CALCULADORA "POR DIA"
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
// ui_handlers.js

export async function openParkingDetailModal(spotDetails) {
    const modal = document.getElementById('parking-detail-modal');
    if (!modal) {
        console.error("Erro: Modal de detalhes da vaga (parking-detail-modal) não encontrado.");
        return;
    }

    // Esconde a modal por padrão e mostra apenas depois de preencher tudo para evitar piscar de conteúdo
    modal.classList.add('hidden'); // Certifique-se de que está escondida no início

    // Preenche os dados textuais da modal
    document.getElementById("modal-parking-title").textContent = spotDetails.title;
    document.getElementById("modal-parking-address").textContent = spotDetails.address;
    document.getElementById("modal-parking-description").textContent = spotDetails.description;

    const reservationSpotIdInput = document.getElementById('reservation-spot-id');
    if (reservationSpotIdInput) {
        reservationSpotIdInput.value = spotDetails.id;
    } else {
        console.error("Erro: Elemento reservation-spot-id não encontrado.");
    }
    
    // --- LÓGICA DO CARROSSEL DE IMAGENS DA VAGA (CORRIGIDA) ---
    
    // 1. Prepara as fotos
    const photos = (spotDetails.photos && spotDetails.photos.length > 0) 
        ? spotDetails.photos 
        : ['/static/parking/css/images/placeholder.png'];
    
    // 2. Encontra o container da imagem principal da vaga no modal
    // Este é o container que você mostrou na Imagem 2 (do carro)
    const modalMainImageWrapper = modal.querySelector('#modal-parking-main-image-wrapper'); // <--- NOVO ID NO HTML

    if (modalMainImageWrapper) {
        // Estado do botão de favorito
        const isFavorite = spotDetails.is_favorite || false;
        const heartIconClass = isFavorite ? "fas fa-heart text-red-500" : "far fa-heart text-gray-500";

        modalMainImageWrapper.innerHTML = `
            <div class="relative w-full h-56 rounded-xl overflow-hidden group/modal-carousel">
                <img
                    src="${photos[0]}"
                    alt="${spotDetails.title}"
                    class="w-full h-full object-cover modal-carousel-image transition-opacity duration-300"
                    data-current-index="0"
                    id="modal-parking-image"
                    onerror="this.onerror=null;this.src='/static/parking/css/images/placeholder.png';"
                />
                
                <button id="modal-favorite-btn" class="absolute top-3 right-3 z-20 bg-white p-2 rounded-full shadow-md hover:scale-105 transition-transform focus:outline-none group">
                    <i class="${heartIconClass} text-lg"></i>
                </button>

                ${photos.length > 1 ? `
                    <button class="modal-carousel-prev absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 rounded-full p-2 shadow-md opacity-0 group-hover/modal-carousel:opacity-100 transition-opacity z-10 hover:scale-110">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button class="modal-carousel-next absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 rounded-full p-2 shadow-md opacity-0 group-hover/modal-carousel:opacity-100 transition-opacity z-10 hover:scale-110">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    
                    <div class="absolute bottom-2 left-0 right-0 flex justify-center space-x-1.5 z-10 pointer-events-none">
                        ${photos.map((_, idx) => `
                            <div class="w-2 h-2 rounded-full shadow-sm transition-colors duration-200 ${idx === 0 ? 'bg-white' : 'bg-white/50'} modal-carousel-dot" data-idx="${idx}"></div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        // --- Lógica JS para o Carrossel do Modal ---
        if (photos.length > 1) {
            // Seletor corrigido para usar a classe do carrossel do modal
            const imgElement = modalMainImageWrapper.querySelector('.modal-carousel-image'); 
            const prevBtn = modalMainImageWrapper.querySelector('.modal-carousel-prev');
            const nextBtn = modalMainImageWrapper.querySelector('.modal-carousel-next');
            const dots = modalMainImageWrapper.querySelectorAll('.modal-carousel-dot');

            const updateImage = (newIndex) => {
                imgElement.src = photos[newIndex];
                imgElement.dataset.currentIndex = newIndex;
                dots.forEach((dot, idx) => {
                    if (idx === newIndex) {
                        dot.classList.remove('bg-white/50');
                        dot.classList.add('bg-white');
                    } else {
                        dot.classList.add('bg-white/50');
                        dot.classList.remove('bg-white');
                    }
                });
            };

            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                let idx = parseInt(imgElement.dataset.currentIndex);
                idx = (idx - 1 + photos.length) % photos.length;
                updateImage(idx);
            });

            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                let idx = parseInt(imgElement.dataset.currentIndex);
                idx = (idx + 1) % photos.length;
                updateImage(idx);
            });
        }
    } else {
        console.error("Erro: Container #modal-parking-main-image-wrapper não encontrado no modal.");
    }
    // --- FIM DA LÓGICA DO CARROSSEL ---


    // Formata o preço por hora
    const priceHour = parseFloat(spotDetails.price_hour);
    const priceHourFormatted = isNaN(priceHour) ? 'N/A' : `R$ ${priceHour.toFixed(2).replace('.', ',')}/h`;

    // Preenche os campos de detalhes
    document.getElementById("modal-parking-type-display").textContent = `Tipo: ${formatarTipoVaga(spotDetails.tipo_vaga)}`;
    document.getElementById("modal-parking-size-display").textContent = `Tamanho: ${formatarTamanhoVaga(spotDetails.size)}`;
    document.getElementById("modal-parking-hours-display").textContent = `Disponível: ${formatarHorarioDisponivelModal(spotDetails)}`;
    document.getElementById("modal-parking-price-display").textContent = `Preço por hora: ${priceHourFormatted}`;

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

    // Mostra a modal (agora com o conteúdo já preenchido)
    modal.classList.remove('hidden');

    const closeModalBtn = document.getElementById("close-modal");
    if (closeModalBtn) {
        // É importante clonar e substituir para remover listeners antigos
        const newCloseBtn = closeModalBtn.cloneNode(true);
        closeModalBtn.parentNode.replaceChild(newCloseBtn, closeModalBtn);
        newCloseBtn.onclick = () => {
            modal.classList.add("hidden");
        };
    }

    console.log("Spot Details completo recebido na função:", spotDetails);

    currentSpotDetails = spotDetails;
    currentSpotId = spotDetails.id;
    
    // Inicializa o calendário e os seletores de hora (certifique-se de que initializeReservationComponents 
    // está importado ou definido globalmente)
    initializeReservationComponents(modal, spotDetails);

    // Lógica do vendedor
    const modalSellerProfileImage = document.getElementById('modal-seller-profile-image');
    const modalSellerName = document.getElementById('modal-seller-name');
    const profileImage = document.getElementById('modal-seller-profile-image');
    const popover = document.getElementById('seller-info-popover');

    if (modalSellerProfileImage && modalSellerName) {
        if (spotDetails.owner && spotDetails.owner.perfil) {
            modalSellerName.textContent = spotDetails.owner.perfil.nome_completo || 'Vendedor não disponível';
            const sellerPhotoUrl = spotDetails.owner.perfil.foto;
            if (sellerPhotoUrl) {
                modalSellerProfileImage.src = sellerPhotoUrl;
            } else {
                modalSellerProfileImage.src = '/static/parking/css/images/default_avatar.png'; // Fallback para avatar
            }
        } else {
            modalSellerName.textContent = 'Vendedor não disponível';
            if (modalSellerProfileImage) {
                modalSellerProfileImage.src = '/static/parking/css/images/default_avatar.png'; // Fallback para avatar
            }
        }
    }

    if (profileImage) {
        // Remova listeners antigos antes de adicionar novos
        const newProfileImage = profileImage.cloneNode(true);
        profileImage.parentNode.replaceChild(newProfileImage, profileImage);
        newProfileImage.addEventListener('click', (e) => {
            e.stopPropagation(); 
            popover.classList.toggle('hidden');

            const sellerName = document.getElementById('modal-seller-name');
            const popoverName = document.getElementById('popover-seller-name');
            if (sellerName && popoverName) {
                popoverName.textContent = sellerName.textContent;
            }

            const rect = newProfileImage.getBoundingClientRect(); // Use newProfileImage aqui
            popover.style.top = `${rect.bottom + window.scrollY + 5}px`;
            popover.style.left = `${rect.left + window.scrollX}px`;
        });
    }

    // Listener para fechar popover do vendedor
    document.addEventListener('click', (e) => {
        if (popover && !popover.contains(e.target) && (!profileImage || !profileImage.contains(e.target))) { // Verifica se profileImage existe
            popover.classList.add('hidden');
        }
    });

    // Lógica para seleção de hora/dia
    const hourlyOptionBox = document.getElementById('reservation-option-hourly');
    const dailyOptionBox = document.getElementById('reservation-option-daily');

    // Remove listeners antigos antes de adicionar novos (para evitar duplicação)
    if (hourlyOptionBox) {
        const newHourlyOptionBox = hourlyOptionBox.cloneNode(true);
        hourlyOptionBox.parentNode.replaceChild(newHourlyOptionBox, hourlyOptionBox);
        newHourlyOptionBox.addEventListener('click', () => {
            if (currentSelectedReservationOption === 'hourly') {
                newHourlyOptionBox.classList.remove('selected-reservation-option');
                currentSelectedReservationOption = null;
                updateReservationSummary(currentSpotDetails, currentSelectedSlot.date, null, null);
            } else {
                document.querySelectorAll('.reservation-option').forEach(option => {
                    option.classList.remove('selected-reservation-option');
                });
                newHourlyOptionBox.classList.add('selected-reservation-option');
                currentSelectedReservationOption = 'hourly';
                const startTimeInput = document.getElementById('start-time-input');
                const endTimeInput = document.getElementById('end-time-input');
                updateReservationSummary(currentSpotDetails, currentSelectedSlot.date, startTimeInput.value, endTimeInput.value);
            }
        });
    }

    if (dailyOptionBox) {
        const newDailyOptionBox = dailyOptionBox.cloneNode(true);
        dailyOptionBox.parentNode.replaceChild(newDailyOptionBox, dailyOptionBox);
        newDailyOptionBox.addEventListener('click', () => {
            if (currentSelectedReservationOption === 'daily') {
                newDailyOptionBox.classList.remove('selected-reservation-option');
                currentSelectedReservationOption = null;
                const startTimeInput = document.getElementById('start-time-input');
                const endTimeInput = document.getElementById('end-time-input');
                updateReservationSummary(currentSpotDetails, currentSelectedSlot.date, startTimeInput.value, endTimeInput.value);
            } else {
                document.querySelectorAll('.reservation-option').forEach(option => {
                    option.classList.remove('selected-reservation-option');
                });
                newDailyOptionBox.classList.add('selected-reservation-option');
                currentSelectedReservationOption = 'daily';
                updateReservationSummary(currentSpotDetails, currentSelectedSlot.date, null, null); 
            }
        });
    }

    // Configura o botão de favorito do modal (deve ser re-conectado pois o HTML foi recriado)
    const modalFavBtn = document.getElementById('modal-favorite-btn');
    
    if (modalFavBtn) {
        // 1. Define estado inicial visual
        const icon = modalFavBtn.querySelector('i') || modalFavBtn.querySelector('svg'); // Aceita ambos
        const isFav = favoritedSpotIds.has(spotDetails.id);
        
        // Função auxiliar para atualizar visual
        const updateIcon = (active) => {
            // Se estiver usando FontAwesome (<i>)
            if (icon.tagName === 'I') {
                icon.className = active ? "fas fa-heart text-red-500 text-lg" : "far fa-heart text-gray-500 text-lg";
            } 
            // Se estiver usando SVG
            else if (icon.tagName === 'svg') {
                icon.setAttribute('fill', active ? 'currentColor' : 'none');
                icon.classList.toggle('text-red-500', active);
                icon.classList.toggle('text-gray-400', !active);
            }
        };
        
        updateIcon(isFav);

        // 2. Configura o clique
        const newModalFavBtn = modalFavBtn.cloneNode(true);
        modalFavBtn.parentNode.replaceChild(newModalFavBtn, modalFavBtn);

        newModalFavBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            
            // Toggle (Inverte)
            if (favoritedSpotIds.has(spotDetails.id)) {
                favoritedSpotIds.delete(spotDetails.id);
                // Precisamos pegar o ícone de dentro do NOVO botão clonado
                const currentIcon = newModalFavBtn.querySelector('i') || newModalFavBtn.querySelector('svg');
                if(currentIcon.tagName === 'I') currentIcon.className = "far fa-heart text-gray-500 text-lg";
                // Adicione lógica SVG se necessário
            } else {
                favoritedSpotIds.add(spotDetails.id);
                const currentIcon = newModalFavBtn.querySelector('i') || newModalFavBtn.querySelector('svg');
                if(currentIcon.tagName === 'I') currentIcon.className = "fas fa-heart text-red-500 text-lg";
            }
            saveFavoritesToStorage();
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

    // --- LÓGICA DE STATUS ATUALIZADA ---
    const statusContainer = document.createElement("div");
    statusContainer.className = "absolute top-4 right-2";
    const statusSpan = document.createElement("span");
    statusSpan.className = "text-xs px-2 py-1 rounded font-semibold";

    // Prioriza o status do banco de dados
    switch(reservation.status) {
        case 'pending':
            statusSpan.textContent = "Pendente";
            statusSpan.classList.add("bg-yellow-100", "text-yellow-800");
            break;
        case 'confirmed':
            statusSpan.textContent = "Confirmada";
            statusSpan.classList.add("bg-green-100", "text-green-800");
            break;
        case 'refused':
            statusSpan.textContent = "Recusada";
            statusSpan.classList.add("bg-red-100", "text-red-800");
            break;
        case 'cancelled':
            statusSpan.textContent = "Cancelada";
            statusSpan.classList.add("bg-gray-100", "text-gray-800");
            break;
        default:
            statusSpan.textContent = reservation.status; // Caso tenha algum status inesperado
            statusSpan.classList.add("bg-gray-100", "text-gray-800");
    }
    
    // Verifica se a reserva já terminou (mesmo se foi confirmada)
    const now = new Date();
    const endDate = new Date(reservation.end_time);
    const isReservationActive = now < endDate;

    if (!isReservationActive && reservation.status === 'confirmed') {
        statusSpan.textContent = "Finalizada";
        statusSpan.classList.remove("bg-green-100", "text-green-800");
        statusSpan.classList.add("bg-gray-100", "text-gray-800");
    }
    // --- FIM DA LÓGICA DE STATUS ---

    statusContainer.appendChild(statusSpan);
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
    const detailsButton = document.createElement("button");
    detailsButton.className = "mt-auto bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition duration-200";
    detailsButton.textContent = "Mostrar detalhes >";

    // O botão de chat só será criado no modal de detalhes se a reserva for confirmada
    detailsButton.addEventListener("click", () => {
        openReservationDetailModal(reservation);
    });

    content.appendChild(detailsButton);

    // Botão de cancelar, visível apenas para reservas ativas E que estejam pendentes/confirmadas
    if (isReservationActive && (reservation.status === 'pending' || reservation.status === 'confirmed')) {
        const cancelButton = document.createElement("button");
        cancelButton.className = "mt-2 bg-red-600 text-white py-2 rounded hover:bg-red-700 transition duration-200";
        cancelButton.textContent = "Cancelar Reserva";

        cancelButton.addEventListener("click", () => {
            showConfirmModal("Tem certeza que deseja cancelar esta reserva?", async () => {
                // Esta callback só será executada se o usuário clicar em "Sim, cancelar"
                try {
                    const token = getAuthToken();
                    const csrfToken = getCsrfToken();
                    const url = `http://127.0.0.1:8000/parking/api/reservations/${reservation.id}/`;

                    const response = await fetch(url, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Token ${token}`,
                            'X-CSRFToken': csrfToken,
                        },
                    });

                    if (response.ok) {
                        showToast('Reserva cancelada com sucesso.', true);
                        // Recarrega a lista de reservas
                        carregarMinhasReservas(); 
                    } else {
                        const errorData = await response.json();
                        const errorMessage = errorData.detail || 'Erro ao cancelar a reserva.';
                        showToast(errorMessage, false);
                    }
                } catch (error) {
                    console.error('Falha ao cancelar reserva:', error);
                    showToast('Não foi possível cancelar a reserva. Tente novamente.', false);
                }
            });
        });

        content.appendChild(cancelButton);
    }
    
    card.appendChild(content);
    container.appendChild(card);
}

export function activateChatTab(convId) {
    // 1. Simular o clique na aba de chat
    const chatTabBtn = document.querySelector('[data-tab="chat"]');
    if (chatTabBtn) {
        chatTabBtn.click();
    }

    // 2. Carregar a conversa correta
    setTimeout(() => {
        // Encontra o item da lista de conversas correspondente e clica nele
        const conversationItem = document.querySelector(`li[data-conversation-id="${convId}"]`);
        if (conversationItem) {
            conversationItem.click();
        }
    }, 200); // 200ms de atraso 
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

    const chatButtonContainer = document.getElementById('chat-button-container');
    if (chatButtonContainer) {
        chatButtonContainer.innerHTML = ''; 

        if (reservation.conversation_id) {
        const chatBtn = document.createElement("button");
        chatBtn.textContent = "Iniciar Chat";
        chatBtn.className = "mt-4 w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700 transition duration-200";
        chatButtonContainer.appendChild(chatBtn);

        chatBtn.addEventListener('click', () => {
            activateChatTab(reservation.conversation_id);
        });
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

    const closeBtn = document.getElementById("close-reservation-modal");
    if (closeBtn) closeBtn.onclick = () => modal.classList.add("hidden");
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
        
        // Salvando os dados da API em uma variável global
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
                            
                            // Renderiza os horários reservados
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
        window.currentSpotData = null; // Garante que a variável seja limpa em caso de erro
        noSlotsMessageP.textContent = "Erro ao carregar disponibilidade das vagas. Verifique sua conexão ou tente novamente.";
        noSlotsMessageP.classList.remove('hidden');
    }
}

// Setup dos Listeners de Modais e Botões de Ação
export function setupModalClosers() {
    document.getElementById("close-modal")?.addEventListener("click", () => {
        const modal = document.getElementById("parking-detail-modal");
        if (modal) modal.classList.add("hidden");
    });

    document.getElementById("cancel-edit")?.addEventListener("click", () => {
        document.getElementById("edit-spot-modal").classList.add("hidden");
    });

    document.getElementById("btn-cancel-detail")?.addEventListener("click", () => {
        const modal = document.getElementById("parking-detail-modal");
        if (modal) modal.classList.add("hidden");
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