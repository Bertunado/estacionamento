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
import { showConfirmationModal } from './confirmations.js';
import { initializeReservationComponents } from './calendar.js';
import { formatarTamanhoVaga, formatarTipoVaga, formatarHorarioDisponivelModal, formatDateToISO  } from './format.js';
import { favoriteLists, saveListsToStorage, isSpotFavorited } from './globals.js';
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
let pendingFavoriteChanges = new Map(); // Ex: { listId: 'add', listId_2: 'remove' }
let currentSpotIdForFavorites = null;
let currentSpotImageUrlForFavorites = null;
let html5QrCodeScanner = null;

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
    } else if (tabName === 'profile') {
        renderProfileFavorites();
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

    // 1. Limpa as mudanças pendentes da última vez
    pendingFavoriteChanges.clear(); 
    
    // 2. Armazena os dados da vaga atual
    currentSpotIdForFavorites = spot.id;
    currentSpotImageUrlForFavorites = (spot.photos && spot.photos.length > 0) 
        ? spot.photos[0] 
        : '/static/parking/css/images/placeholder.png';

    renderFavoriteListsInModal(spot.id); // Desenha as listas
    modal.classList.remove('hidden');
}

// Desenha os quadrados das listas dentro do modal
function renderFavoriteListsInModal(spotId) {
    const container = document.getElementById('favorites-list-container');
    if (!container) return;
    container.innerHTML = ''; 

    const idStr = String(spotId);
    
    favoriteLists.forEach(list => {
        // 1. O estado "original" (como está no localStorage)
        const isCurrentlySaved = list.spots.some(item => String(item.id) === idStr);
        
        // 2. O estado "pendente" (o que o usuário clicou AGORA)
        const pendingAction = pendingFavoriteChanges.get(list.id);
        
        // 3. Define o visual final (o que o usuário deve ver)
        let isVisuallySaved = isCurrentlySaved;
        if (pendingAction === 'add') {
            isVisuallySaved = true;
        } else if (pendingAction === 'remove') {
            isVisuallySaved = false;
        }

        const card = document.createElement('div');
        card.className = "cursor-pointer group relative";

        // 4. ATUALIZA O ONCLICK:
        // Agora ele só mexe no 'pendingFavoriteChanges' e redesenha o modal
        card.onclick = () => {
            const currentAction = pendingFavoriteChanges.get(list.id);

            if (currentAction) {
                // O usuário já clicou, vamos reverter a mudança pendente
                pendingFavoriteChanges.delete(list.id);
            } else {
                // Primeiro clique: inverte o estado salvo
                if (isCurrentlySaved) {
                    pendingFavoriteChanges.set(list.id, 'remove'); // Clicou em algo salvo = marcar para remover
                } else {
                    pendingFavoriteChanges.set(list.id, 'add'); // Clicou em algo não salvo = marcar para adicionar
                }
            }
            // Re-desenha o modal para mostrar a mudança
            renderFavoriteListsInModal(spotId);
        };
        // --- FIM DO ONCLICK ---

        const firstSpotImageUrl = list.spots.length > 0 ? list.spots[0].imageUrl : null;
        let coverHtml = '';
        if (firstSpotImageUrl) {
            coverHtml = `<img src="${firstSpotImageUrl}" class="w-full h-full object-cover rounded-xl">`;
        } else {
            coverHtml = `<div class="w-full h-full bg-gray-100 flex items-center justify-center rounded-xl"><i class="fas fa-heart text-gray-300 text-3xl list-heart-icon"></i></div>`;
        }

        card.innerHTML = `
            <div class="aspect-square rounded-xl overflow-hidden border ${isVisuallySaved ? 'border-gray-800' : 'border-gray-200'} shadow-sm mb-2 transition-all transform group-hover:scale-105">
                ${coverHtml}
                ${isVisuallySaved ? 
                    `<div class="absolute top-2 right-2 bg-gray-900 text-white p-1.5 rounded-full shadow-sm"><i class="fas fa-check text-xs"></i></div>` 
                    : ''}
            </div>
            <h4 class="text-sm font-bold text-gray-800 truncate">${list.name}</h4>
            <p class="text-xs text-gray-500">${list.spots.length} vaga(s)</p>
        `;
        container.appendChild(card);
    });
}

// Salva ou remove a vaga da lista clicada
function toggleSpotInList(listId, spotId, imageUrl) { // Adicione imageUrl aqui
    const list = favoriteLists.find(l => l.id === listId);
    if (!list) return;

    const idStr = String(spotId);
    // Encontra o item da vaga na lista, verificando o ID
    const spotItemIndex = list.spots.findIndex(item => String(item.id) === idStr);

    if (spotItemIndex > -1) {
        list.spots.splice(spotItemIndex, 1); // Remove
    } else {
        // CORREÇÃO: Garante que a imageUrl tenha um valor de fallback
        const safeImageUrl = imageUrl || '/static/parking/css/images/placeholder.png';
        
        // Adiciona a vaga como um objeto { id, imageUrl }
        list.spots.push({ id: idStr, imageUrl: safeImageUrl }); 
        document.getElementById('favorites-modal').classList.add('hidden');
    }

    saveListsToStorage(); 
    updateAllHeartIcons(spotId); 

    // Atualiza o modal de listas se ainda estiver aberto, para refletir as mudanças
    const modal = document.getElementById('favorites-modal');
    if (modal && !modal.classList.contains('hidden')) {
        renderFavoriteListsInModal(modal.dataset.currentSpotId);
    }
    
    // NOVO: Se o perfil estiver visível, atualiza os favoritos lá também
    if (!document.getElementById('profile').classList.contains('hidden')) {
        renderProfileFavorites();
    }
}

// Atualiza a cor de TODOS os corações na tela
export function updateAllHeartIcons(spotId) {
    const isFav = isSpotFavorited(spotId); // Verifica se está em QUALQUER lista
    const newClass = isFav ? "fas fa-heart text-red-500" : "far fa-heart text-gray-400";
    
    // Atualiza corações nos cards da lista
    document.querySelectorAll(`.btn-favorite[data-spot-id="${spotId}"] i`).forEach(icon => {
        icon.className = `${newClass} text-lg transition-colors`;
    });

    // Atualiza coração no modal de detalhes (se estiver aberto)
    const modalBtnIcon = document.querySelector(`#modal-favorite-btn[data-spot-id="${spotId}"] i`);
    if (modalBtnIcon) {
        modalBtnIcon.className = `${newClass} text-lg transition-colors`;
    }
}

// Configura os botões "Criar Lista" e "Fechar" do modal
export function setupFavoritesLogic() {
    // Referências aos modais e ao input
    const favoritesModal = document.getElementById('favorites-modal');
    const createListModal = document.getElementById('create-list-modal');
    const newListNameInput = document.getElementById('new-list-name-input');
    const createListError = document.getElementById('create-list-error');

    // Botão "Criar nova lista de favoritos"
    document.getElementById("create-fav-list-btn")?.addEventListener("click", () => {
        if (favoritesModal) favoritesModal.classList.add('hidden');
        if (createListModal) createListModal.classList.remove('hidden');
        if (newListNameInput) newListNameInput.focus();
        if (createListError) createListError.classList.add('hidden');
    });

    // Botão "Cancelar" (no modal de criação)
    document.getElementById("cancel-create-list-btn")?.addEventListener("click", () => {
        if (createListModal) createListModal.classList.add('hidden');
        if (favoritesModal) favoritesModal.classList.remove('hidden'); 
    });

    document.getElementById("cancel-delete-list-btn")?.addEventListener("click", () => {
        document.getElementById("delete-list-confirm-modal").classList.add("hidden");
    });

    // Botão "Excluir" (do modal de exclusão de lista)
    document.getElementById("confirm-delete-list-btn")?.addEventListener("click", (e) => {
        const listId = e.currentTarget.dataset.listId;
        if (!listId) return;

        // --- 👇 AQUI ESTÁ A CORREÇÃO 👇 ---
        
        // 1. Encontra o índice da lista a ser removida
        const listIndex = favoriteLists.findIndex(list => list.id === listId);

        // 2. Remove a lista do array original (mutação)
        if (listIndex > -1) {
            favoriteLists.splice(listIndex, 1);
        } else {
            console.warn(`Não foi possível encontrar a lista com ID ${listId} para excluir.`);
            return;
        }
        // --- 👆 FIM DA CORREÇÃO 👆 ---
        
        // 2. Salva a mudança no localStorage
        saveListsToStorage();
        
        // 3. Atualiza a tela do perfil
        renderProfileFavorites();
        
        // 4. Fecha o modal de confirmação
        document.getElementById("delete-list-confirm-modal").classList.add("hidden");
    });

    // Botão "Salvar" (no modal de criação)
    document.getElementById("confirm-create-list-btn")?.addEventListener("click", () => {
        const name = newListNameInput.value;
        
        if (name && name.trim() !== '') {
            favoriteLists.push({ id: Date.now().toString(), name: name, spots: [] });
            saveListsToStorage();
            newListNameInput.value = '';
            if (createListModal) createListModal.classList.add('hidden');
            
            const spotId = favoritesModal.dataset.currentSpotId;
            
            if (favoritesModal) {
                renderFavoriteListsInModal(spotId);
                favoritesModal.classList.remove('hidden');
            }
        } else {
            if (createListError) createListError.classList.remove('hidden');
        }
    });

    // Botão Fechar (X) do modal de listas
    document.getElementById("close-favorites-modal")?.addEventListener("click", () => {
        if (favoritesModal) favoritesModal.classList.add("hidden");
    });
    
    // --- 👇 ESTE É O BLOCO QUE ESTAVA FALTANDO 👇 ---
    // Listener do Botão "Salvar" principal (do modal de listas)
    document.getElementById("save-favorites-btn")?.addEventListener("click", () => {
        
        // 1. Aplica as mudanças pendentes (marcadas/desmarcadas)
        pendingFavoriteChanges.forEach((action, listId) => {
            const list = favoriteLists.find(l => l.id === listId);
            if (!list) return;

            const idStr = String(currentSpotIdForFavorites);
            const spotItemIndex = list.spots.findIndex(item => String(item.id) === idStr);

            if (action === 'add' && spotItemIndex === -1) {
                // Adiciona
                list.spots.push({ id: idStr, imageUrl: currentSpotImageUrlForFavorites || '' });
            } else if (action === 'remove' && spotItemIndex > -1) {
                // Remove
                list.spots.splice(spotItemIndex, 1);
            }
        });
        
        // 2. Salva tudo no localStorage (apenas se houver mudanças)
        if (pendingFavoriteChanges.size > 0) {
            saveListsToStorage();
            updateAllHeartIcons(currentSpotIdForFavorites); // Atualiza os corações
        }

        // 3. Limpa e fecha o modal
        pendingFavoriteChanges.clear();
        if (favoritesModal) favoritesModal.classList.add("hidden");
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
    const container = document.getElementById('profile-favorites-container');
    if (!container) return;

    container.innerHTML = ''; 

    if (!favoriteLists || favoriteLists.length === 0) {
        container.innerHTML = '<p class="text-gray-500 col-span-2">Você ainda não criou nenhuma lista de favoritos.</p>';
        return;
    }

    favoriteLists.forEach(list => {
        const card = document.createElement('div');
        // Adicionado 'relative' para o botão da lixeira
        card.className = "cursor-pointer group flex flex-col relative";
        
        const firstSpotImageUrl = list.spots.length > 0 ? list.spots[0].imageUrl : null;

        let coverHtml = '';
        if (firstSpotImageUrl) {
            coverHtml = `<img src="${firstSpotImageUrl}" class="w-full h-full object-cover rounded-xl">`;
        } else {
            coverHtml = `<div class="w-full h-full bg-gray-100 flex items-center justify-center rounded-xl"><i class="fas fa-heart text-gray-300 text-3xl"></i></div>`;
        }

        card.innerHTML = `
            <div class="aspect-square rounded-xl overflow-hidden border border-gray-200 shadow-sm mb-2 transition-transform transform group-hover:scale-105">
                ${coverHtml}

                <button class="btn-delete-list absolute top-2 right-2 bg-white/80 rounded-full w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                        data-list-id="${list.id}">
                    <i class="fas fa-trash-alt text-xs"></i>
                </button>
                </div>
            <h4 class="text-sm font-bold text-gray-800 truncate">${list.name}</h4>
            <p class="text-xs text-gray-500">${list.spots.length} vaga(s)</p>
        `;
        
        // Listener para abrir a lista
        card.addEventListener("click", () => {
            // Chama a nova função que criaremos abaixo
            openListDetailModal(list); 
        });

        // Listener para o botão de deletar
        const deleteBtn = card.querySelector('.btn-delete-list');
        if (deleteBtn) {
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // Impede que o clique na lixeira abra a lista
                
                const listId = e.currentTarget.dataset.listId;
                const modal = document.getElementById('delete-list-confirm-modal');
                const confirmBtn = document.getElementById('confirm-delete-list-btn');

                if (modal && confirmBtn) {
                    // Passa o ID da lista para o botão "Excluir" do modal
                    confirmBtn.dataset.listId = listId;
                    modal.classList.remove('hidden');
                }
            });
        }

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
function showSuccessModal(message) {
    const modal = document.getElementById('success-modal');
    const messageEl = document.getElementById('success-message');
    const okBtn = document.getElementById('success-ok-button');

    if (!modal || !messageEl || !okBtn) {
        console.error("Elementos do modal de sucesso não encontrados!");
        // Caso o modal falhe, volta para o alert
        alert(message);
        return;
    }

    // Define a mensagem
    messageEl.textContent = message;

    // Remove listeners antigos do botão OK para evitar cliques duplicados
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    
    // Adiciona o novo listener para fechar
    newOkBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // Mostra o modal
    modal.classList.remove('hidden');
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
            
            // --- 👇 ESTA É A MUDANÇA 👇 ---
    
            // Monta a mensagem de sucesso
            const successMessage = (action === 'approve') 
                ? 'Reserva Aprovada com sucesso!' 
                : 'Reserva Recusada com sucesso!';
            
            // Chama o novo modal!
            showSuccessModal(successMessage);
            
            // --- 👆 FIM DA MUDANÇA 👆 ---
            
            // Recarrega a lista para atualizar o contador da badge
            await loadReservationRequests();
    
        } catch (error) {
            console.error(`Erro ao ${action} reserva:`, error);
            const errorMessage = error.detail || `Falha ao ${action === 'approve' ? 'aprovar' : 'recusar'} reserva.`;
            
            // --- 👇 MUDANÇA BÔNUS (para tirar o alert de erro) 👇 ---
            // alert(errorMessage); // Substituído
            showErrorModal(errorMessage);
            // --- 👆 FIM DA MUDANÇA BÔNUS 👆 ---
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
    const isFav = isSpotFavorited(spot.id);
    const heartIconClass = isFav ? "fas fa-heart text-red-500" : "far fa-heart text-gray-400";
    // Define as classes iniciais (Vermelho Sólido ou Cinza Outline)

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

    const reservarBtn = card.querySelector(".btn-reservar");
    if (reservarBtn) {
        reservarBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            console.log("Clique no botão 'Reservar'. Abrindo modal de detalhes.");
            openParkingDetailModal(spot);
        });
    }

    const favBtn = card.querySelector(".btn-favorite");
    if (favBtn) {
        favBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            
            // Verifica se a vaga já está salva
            const isFav = isSpotFavorited(spot.id);
            
            if (isFav) {
                // Já é favorito -> REMOVE IMEDIATO
                // (O usuário não precisa selecionar de qual lista remover)
                if (confirm("Remover esta vaga dos seus favoritos?")) {
                    favoriteLists.forEach(list => {
                        const spotItemIndex = list.spots.findIndex(item => String(item.id) === String(spot.id));
                        if (spotItemIndex > -1) {
                            list.spots.splice(spotItemIndex, 1);
                        }
                    });
                    saveListsToStorage();
                    updateAllHeartIcons(spot.id); // Atualiza o coração para cinza
                }
            } else {
                // Não é favorito -> ABRE MODAL PARA ESCOLHER A LISTA
                openFavoritesModal(spot); 
            }
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

    card.addEventListener("click", () => {
        openParkingDetailModal(spot);
    });
}

function openMySpotSlotsModal(spot) {
    const modal = document.getElementById('spot-slots-modal');
    const titleEl = document.getElementById('spot-slots-title');
    const listEl = document.getElementById('spot-slots-list');
    const closeBtn = document.getElementById('close-spot-slots-modal');

    if (!modal || !titleEl || !listEl || !closeBtn) {
        console.error("Elementos do modal 'spot-slots-modal' não encontrados.");
        return;
    }

    // 1. Limpa a lista antiga e preenche o título
    listEl.innerHTML = '';
    titleEl.textContent = `Vagas em "${spot.title}"`;

    // 2. Cria os botões para cada slot (baseado na 'quantity' do spot)
    const totalSlots = spot.quantity || 1; // Assume 1 se 'quantity' não estiver definida

    for (let i = 1; i <= totalSlots; i++) {
        const slotNumber = i;
        const button = document.createElement('button');
        button.className = "w-full text-left p-4 bg-gray-100 rounded-lg hover:bg-indigo-100 hover:text-indigo-700 transition-colors";
        button.textContent = `Vaga ${slotNumber}`;
        
        // Adiciona o listener para abrir o Modal 2 (o do QR Code)
        button.onclick = () => {
            modal.classList.add('hidden'); // Fecha este modal
            showSlotQRCodeModal(spot, slotNumber); // Abre o próximo
        };
        
        listEl.appendChild(button);
    }

    // 3. Botão de fechar e exibe o modal
    closeBtn.onclick = () => modal.classList.add('hidden');
    modal.classList.remove('hidden');
}


/**
 * Abre o Modal 2: Gera e exibe o QR Code para um slot específico.
 */
function showSlotQRCodeModal(spot, slotNumber) {
    const modal = document.getElementById('slot-qrcode-modal');
    const titleEl = document.getElementById('slot-qrcode-title');
    const qrDisplayEl = document.getElementById('qrcode-display');
    const closeBtn = document.getElementById('close-slot-qrcode-modal');
    
    if (!modal || !titleEl || !qrDisplayEl || !closeBtn) {
        console.error("Elementos do modal 'slot-qrcode-modal' não encontrados.");
        return;
    }

    // 1. Define o título
    titleEl.textContent = `QR Code da Vaga ${slotNumber}`;
    
    // 2. Limpa o QR code antigo
    qrDisplayEl.innerHTML = '';

    // 3. Define os dados que o QR Code conterá
    const qrData = JSON.stringify({
        spot_id: spot.id,
        slot_number: slotNumber
    });

    // 4. Gera o novo QR Code usando a biblioteca qrcode.js
    try {
        new QRCode(qrDisplayEl, {
            text: qrData,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    } catch (e) {
        console.error("Erro ao gerar QR Code:", e);
        qrDisplayEl.textContent = "Erro ao gerar QR Code.";
    }

    // 5. Botão de fechar e exibe o modal
    closeBtn.onclick = () => modal.classList.add('hidden');
    modal.classList.remove('hidden');
}

// Página de Minhas Vagas
export function renderMySpot(spot) {
    const container = document.getElementById("myVagasContainer");
    if (!container) return;

    const desativada = spot.status === "Desativada";
    const card = document.createElement("div");
    card.className = "border border-gray-200 rounded-lg p-3 hover:bg-gray-50 mb-2";

    card.addEventListener('click', () => {
        // Chama a nova função para abrir o modal de slots
        openMySpotSlotsModal(spot); 
    });

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
                <button class="bg-indigo-600 text-white px-3 py-1 text-sm rounded hover:bg-indigo-700">
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
    
    // 1. Busca os horários (e salva em window.currentSpotData)
     await renderVagaSquares(selectedDates);
    
    
     const firstDateStr = selectedDates.length > 0 ? formatDateToISO(selectedDates[0]) : null;
    
     updateReservationSummary(currentSpotDetails, firstDateStr, null, null);
        
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
// MUDANÇA 1: Usar 'let' para que os valores possam ser modificados
let startTime = document.getElementById('start-time-input').value;
 let endTime = document.getElementById('end-time-input').value;
const selectedDateStr = currentSelectedSlot.date;

 const timeOverlapErrorP = document.getElementById('time-overlap-error');
 if (timeOverlapErrorP) timeOverlapErrorP.classList.add('hidden');

 // --- Validação 1: Vaga física selecionada? ---
 if (currentSelectedSlot.slotNumber === null) {
showErrorModal("Por favor, selecione a vaga física.");
return;
 }
 const slotNumber = currentSelectedSlot.slotNumber;

 // --- MUDANÇA 2: LÓGICA DE VALIDAÇÃO CORRIGIDA ---
            if (currentSelectedReservationOption === 'hourly') {
                // Se for 'Por Hora', os campos de horário são obrigatórios
                if (!startTime || !endTime) {
                    // Este é o erro que você viu!
                    showErrorModal("Por favor, preencha a data e os horários da reserva.");
                    return;
                }
            } else if (currentSelectedReservationOption === 'daily') {
                // Se for 'Por Dia', ignoramos os inputs e buscamos os horários do dia
                const selectedAvailability = window.currentSpotData.dates_availability.find(av => av.date === selectedDateStr);

                if (selectedAvailability && selectedAvailability.day_start_time && selectedAvailability.day_end_time) {
                    // MUDANÇA 3: Atribuímos os horários do dia às nossas variáveis
                    startTime = selectedAvailability.day_start_time;
                    endTime = selectedAvailability.day_end_time;
                    console.log(`Modo 'Por Dia' detectado. Usando horários: ${startTime} - ${endTime}`);
                } else {
                    showErrorModal("Não foi possível encontrar os horários de 'diária' para esta vaga. Tente selecionar a data novamente.");

            return;
                }
           } else {
                // Se for nulo (nenhuma opção selecionada)
                showErrorModal("Por favor, selecione uma opção de reserva (Por Hora ou Por Dia).");
                return;
            }
            
            const startDateTime = new Date(`${selectedDateStr}T${startTime}:00`);
            const endDateTime = new Date(`${selectedDateStr}T${endTime}:00`);

            // --- Validação 3: Formato de hora válido? ---
            if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
                showErrorModal("Horário ou data de reserva inválidos. Por favor, verifique o formato HH:MM."); // SUBSTITUÍDO
                return;
            }

            // --- Validação 4: Hora de término > hora de início? ---
            if (endDateTime <= startDateTime) {
                showErrorModal("O horário de término deve ser posterior ao horário de início."); // SUBSTITUÍDO
                return;
            }

            // --- Validação 5: Disponibilidade ---
            const selectedAvailability = window.currentSpotData.dates_availability.find(av => av.date === selectedDateStr);
            if (!selectedAvailability) {
                console.error("Dados de disponibilidade para a data selecionada não encontrados.");
                showErrorModal("Ocorreu um erro ao verificar a disponibilidade. Tente novamente."); // SUBSTITUÍDO
                return;
            }

            // --- 👇 VALIDAÇÃO NOVA QUE VOCÊ PEDIU 👇 ---
            const dayStartTime = selectedAvailability.day_start_time; // ex: "10:00"
            const dayEndTime = selectedAvailability.day_end_time;     // ex: "15:00"

            if (dayStartTime && dayEndTime) {
                // Comparação de strings (funciona para formato HH:MM)
                if (startTime < dayStartTime) {
                    showErrorModal(`O horário de entrada não pode ser antes das ${dayStartTime}.`);
                    return;
                }
                if (endTime > dayEndTime) {
                    showErrorModal(`O horário de saída não pode ser depois das ${dayEndTime}.`);
                    return;
                }
            }
            // --- FIM DA VALIDAÇÃO NOVA ---
            
            const selectedSlotData = selectedAvailability.slots.find(s => s.slot_number === slotNumber);
            if (!selectedSlotData) {
                console.error("Dados de disponibilidade para o slot selecionado não encontrados.");
                showErrorModal("Ocorreu um erro ao verificar a disponibilidade. Tente novamente."); // SUBSTITUÍDO
                return;
            }
            
            const occupiedTimes = selectedSlotData.occupied_times;

            if (isTimeOverlap(startDateTime, endDateTime, occupiedTimes, selectedDateStr)) {
                timeOverlapErrorP.textContent = "O horário selecionado já está parcial ou totalmente ocupado.";
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
                // 1. Chama a API para criar a reserva
                const newReservation = await createReservation(payload);

                // 2. FECHA o modal de detalhes da vaga (o card grande)
                const detailModal = document.getElementById('parking-detail-modal');
                if (detailModal) {
                    detailModal.classList.add('hidden');
                }

                // 3. MOSTRA o modal de "Reserva Pendente" (o card pequeno)
                showReservationConfirmation({
                    tipo_vaga: newReservation.spot?.tipo_vaga || currentSpotDetails.tipo_vaga,
                    slot_number: newReservation.slot_number,
                    start_time: newReservation.start_time,
                    end_time: newReservation.end_time,
                    total_price: newReservation.total_price
                });

                // 4. Atualiza o resto em segundo plano
                if (typeof loadConversations === 'function') {
                    loadConversations();
                }
                if (typeof renderVagaSquares === 'function') {
                    renderVagaSquares([selectedDateStr]);
                }

            } catch (error) {
                // Se der erro (ex: vaga já reservada), mostra o modal de erro
                showErrorModal(`Erro ao criar a reserva: ${error.message}`);
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

function showErrorModal(message) {
    const modal = document.getElementById('error-modal');
    if (modal) {
        const messageEl = modal.querySelector('.modal-message-placeholder');
        if (messageEl) {
            messageEl.textContent = message;
        }
        modal.classList.remove('hidden');
    }
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

    // Verifica se os elementos HTML existem
    if (!hourlyPriceElement || !totalHoursElement || !totalPriceElement || !dailyPriceElement || !dailyTimesElement || !dailyTotalPriceElement) {
        console.error("Erro: Elementos da calculadora não encontrados no modal.");
        return;
    }

    // Tenta pegar a data selecionada do calendário se não for passada
    if (!selectedSlotDate) {
        const selectedDateObj = reservationCalendarInstance?.selectedDates[0];
        if (selectedDateObj) {
            selectedSlotDate = formatDateToISO(selectedDateObj);
        }
    }

    // Pega os valores dos inputs "Por Hora" (eles podem estar vazios, como você quer)
    const hourlyStartTime = document.getElementById('start-time-input')?.value;
    const hourlyEndTime = document.getElementById('end-time-input')?.value;

    const priceHour = parseFloat(spotDetails.price_hour);
    const priceDay = parseFloat(spotDetails.price_day);

    // LÓGICA DA CALCULADORA "POR HORA" 
    hourlyPriceElement.textContent = `R$ ${priceHour.toFixed(2).replace('.', ',')}`;

    // Esta lógica está correta. Se os inputs de hora estiverem vazios, o total será 0.
    if (!selectedSlotDate || !hourlyStartTime || !hourlyEndTime) {
        totalHoursElement.textContent = '0h 0m';
        totalPriceElement.textContent = 'R$ 0,00';
    } else {
        // Se o usuário preencheu, calcula o total por hora
        const startDateTime = new Date(`${selectedSlotDate}T${hourlyStartTime}`);
        let endDateTime = new Date(`${selectedSlotDate}T${hourlyEndTime}`);

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
        if (hours > 0) totalDurationText += `${hours}h`;
        if (minutes > 0 || (hours === 0 && durationMinutes > 0)) { 
            if (totalDurationText !== '') totalDurationText += ' ';
            totalDurationText += `${minutes}m`;
        }
        totalHoursElement.textContent = totalDurationText || '0m';
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

    // --- 👇 AQUI ESTÁ A CORREÇÃO 👇 ---
    // A lógica para exibir os horários do dia ("08:00 até 18:00")
    
    let dailyDisplayStartTime = 'Selecione';
    let dailyDisplayEndTime = 'uma data';

    // CORREÇÃO: Procurar em 'window.currentSpotData' (da API) em vez de 'spotDetails.availabilities_by_date'
    if (selectedSlotDate && window.currentSpotData && window.currentSpotData.dates_availability) {
        
        const selectedDayAvailability = window.currentSpotData.dates_availability.find(
            av => av.date === selectedSlotDate
        );

        // Verifica se a API (que corrigimos) retornou os horários
        if (selectedDayAvailability && selectedDayAvailability.day_start_time && selectedDayAvailability.day_end_time) {
            dailyDisplayStartTime = selectedDayAvailability.day_start_time; // ex: 08:00
            dailyDisplayEndTime = selectedDayAvailability.day_end_time; // ex: 18:00
            dailyTimesElement.textContent = `${dailyDisplayStartTime} até ${dailyDisplayEndTime}`;
        } else if (selectedDayAvailability) {
            dailyTimesElement.textContent = `Não informado`;
        } else {
            dailyTimesElement.textContent = `Data indisponível`;
        }
    } else {
        // Se 'selectedSlotDate' for nulo
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
                    // CHAMA A NOVA FUNÇÃO em vez de mostrar o popover
                    openSellerProfileModal(currentSpotDetails.owner); 
                });
            }
        
            // Esconde o popover antigo (não o usamos mais)
            if (popover) {
                popover.classList.add('hidden');
            }
        
            // Listener para fechar o popover antigo (só para garantir)
            document.addEventListener('click', (e) => {
                if (popover && !popover.contains(e.target) && (!profileImage || !profileImage.contains(e.target))) {
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
        modalFavBtn.dataset.spotId = spotDetails.id;
        
        // Atualiza a cor inicial do coração
        updateAllHeartIcons(spotDetails.id);

        // Limpa listeners antigos
        const newModalFavBtn = modalFavBtn.cloneNode(true);
        modalFavBtn.parentNode.replaceChild(newModalFavBtn, modalFavBtn);

        // Adiciona o novo listener (Corrigido)
        newModalFavBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            openFavoritesModal(spotDetails); // Abre o modal de listas
        });
    }
}

async function openSellerProfileModal(ownerDetails) {
    const modal = document.getElementById('seller-profile-modal');
    if (!modal) {
        console.error("Modal 'seller-profile-modal' não encontrado no HTML.");
        return;
    }
    
    // 1. Pegar todos os elementos do modal
    const photoEl = document.getElementById('seller-modal-photo');
    const nameEl = document.getElementById('seller-modal-name');
    const spotsTitleEl = document.getElementById('seller-modal-spots-title');
    const spotsListEl = document.getElementById('seller-modal-spots-list');
    const loadingEl = document.getElementById('seller-modal-loading'); // O div "Carregando..."
    const reportBtn = document.getElementById('report-user-btn'); // Botão de denunciar

    // --- 👇 CORREÇÃO PARA O ERRO DO ID 👇 ---
    // 5. Buscar as vagas ANTES de preencher os dados
    if (!ownerDetails || !ownerDetails.id) {
        spotsListEl.innerHTML = '<p class="text-gray-500">Não foi possível carregar as vagas (ID do vendedor não encontrado).</p>';
        
        // Preenche com o que tiver, mesmo se o ID falhar
        nameEl.textContent = (ownerDetails && ownerDetails.perfil) ? (ownerDetails.perfil.nome_completo || ownerDetails.email) : "Vendedor";
        photoEl.src = (ownerDetails && ownerDetails.perfil && ownerDetails.perfil.foto) ? ownerDetails.perfil.foto : '/static/parking/css/images/default_avatar.png';
        spotsTitleEl.textContent = `Vagas de ${nameEl.textContent.split(' ')[0]}`;

        modal.classList.remove('hidden'); // Mostra o modal mesmo com o erro
        return;
    }
    // --- 👆 FIM DA CORREÇÃO 👆 ---

    // 2. Preencher dados estáticos (agora que sabemos que ownerDetails.id existe)
    let sellerName = 'Vendedor';
    let sellerPhoto = '/static/parking/css/images/default_avatar.png'; 

    if (ownerDetails && ownerDetails.perfil) {
        sellerName = ownerDetails.perfil.nome_completo || ownerDetails.email;
        if (ownerDetails.perfil.foto) {
            sellerPhoto = ownerDetails.perfil.foto;
        }
    }
    
    photoEl.src = sellerPhoto;
    nameEl.textContent = sellerName;
    spotsTitleEl.textContent = `Vagas de ${sellerName.split(' ')[0]}`; // "Vagas de [Primeiro Nome]"
    
    // 3. Configurar botão de denunciar
    reportBtn.onclick = () => alert('Função "Denunciar" ainda não implementada.'); // Placeholder
    
    // 4. Mostrar modal e limpar lista antiga
    
    // --- 👇 CORREÇÃO PARA O ERRO 'classList' 👇 ---
    // Checa se 'loadingEl' foi encontrado (ele será 'null' na 2ª vez)
    if (loadingEl) {
        loadingEl.classList.add('hidden'); 
    }
    // --- 👆 FIM DA CORREÇÃO 👆 ---
    
    spotsListEl.innerHTML = ''; // Limpa a lista de vagas antigas
    modal.classList.remove('hidden');

    // 5. Buscar as vagas do vendedor (FILTRANDO LOCALMENTE)
    if (!window.allSpots) {
         spotsListEl.innerHTML = '<p class="text-red-500">Erro: A lista global de vagas (window.allSpots) não está carregada.</p>';
         return;
    }

    const sellerSpots = window.allSpots.filter(spot => spot.owner && spot.owner.id === ownerDetails.id);
    
    // 6. Renderizar as vagas
    if (sellerSpots.length === 0) {
        spotsListEl.innerHTML = '<p class="text-gray-500">Este vendedor não possui vagas ativas.</p>';
        return;
    }

    sellerSpots.forEach(spot => {
        const card = document.createElement('div');
        card.className = "flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer";
        
        card.onclick = () => {
            modal.classList.add('hidden');
            openParkingDetailModal(spot); 
        };

        const photo = (spot.photos && spot.photos.length > 0) ? spot.photos[0] : '/static/parking/css/images/placeholder.png';
        
        card.innerHTML = `
            <img src="${photo}" alt="${spot.title}" class="w-16 h-16 rounded-md object-cover">
            <div class="ml-3">
                <h6 class="font-semibold text-gray-800">${spot.title}</h6>
                <p class="text-sm text-gray-600">${spot.address}</p>
                <span class="font-bold text-sm text-indigo-600">R$ ${parseFloat(spot.price_hour).toFixed(2).replace('.', ',')}/h</span>
            </div>
        `;
        spotsListEl.appendChild(card);
    });
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
            showConfirmationModal(
                                "Tem certeza que deseja cancelar esta reserva?", // 1. message
                                "Sim, cancelar", // 2. confirmText (O ARGUMENTO QUE FALTAVA)
                                async () => { // 3. callback
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
    const checkInBtn = document.getElementById('check-in-qr-btn');
    if (checkInBtn) {
        // Mostra o botão APENAS se a reserva estiver 'confirmada'
        if (reservation.status === 'confirmed') {
            checkInBtn.classList.remove('hidden');
            
            // Limpa listeners antigos e adiciona o novo
            const newCheckInBtn = checkInBtn.cloneNode(true);
            checkInBtn.parentNode.replaceChild(newCheckInBtn, checkInBtn);
            
            newCheckInBtn.onclick = () => {
                // Chama a nova função de scanner, passando a reserva atual
                startQrScanner(reservation);
            };
        } else {
            // Esconde o botão se a reserva não estiver 'confirmada' (ex: pendente, finalizada)
            checkInBtn.classList.add('hidden');
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
            const reservations = await fetchMyReservations(); // Pega todas
            const container = document.getElementById("myReservationsContainer");
        if (container) { container.innerHTML = ""; // Limpa o conteúdo anterior
        // Filtra apenas as reservas 'pending' (Pendente) ou 'confirmed' (Confirmada)
            const activeReservations = reservations.filter(res => 
            res.status === 'pending' || res.status === 'confirmed'
        );
 // --- 👆 FIM DA CORREÇÃO 👆 ---

        if (activeReservations && activeReservations.length > 0) {
            // Agora, itera sobre a lista filtrada
            activeReservations.forEach(res => renderMyReservation(res));
        } else {
// Mensagem atualizada
        container.innerHTML = `<p class="text-center text-gray-400 mt-6 col-span-1 md:col-span-2">Você ainda não possui reservas ativas.</p>`;
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
                        
                        // --- 👇 INÍCIO DA LÓGICA ATUALIZADA 👇 ---
                        
                        let isFullDayOccupied = false;
                        const dayStartStr = availability.day_start_time; // "10:00"
                        const dayEndStr = availability.day_end_time;     // "22:00"

                        if (dayStartStr && dayEndStr && slot.occupied_times.length > 0) {
                            const getMinutes = (timeStr) => {
                                const [h, m] = timeStr.split(':').map(Number);
                                return h * 60 + m;
                            };

                            const dayStart = getMinutes(dayStartStr);
                            const dayEnd = getMinutes(dayEndStr);
                            const totalDayDuration = dayEnd - dayStart;

                            let totalOccupiedDuration = 0;
                            slot.occupied_times.forEach(time => {
                                const start = getMinutes(time.start);
                                const end = getMinutes(time.end);
                                totalOccupiedDuration += (end - start);
                            });

                            if (totalOccupiedDuration >= totalDayDuration) {
                                isFullDayOccupied = true;
                            }
                        }
                        // --- 👆 FIM DA LÓGICA ATUALIZADA 👆 ---
                        
                        square.classList.add(
                            'vaga-square', 'w-10', 'h-10', 'rounded-md', 'flex', 
                            'items-center', 'justify-center', 'font-bold', 'text-white', 
                            'text-lg', 'select-none', 'border-2', 'transition-colors', 'm-1'
                        );
                        square.textContent = slot.slot_number;
                        square.dataset.vagaNumber = slot.slot_number;
                        square.dataset.slotDate = availability.date; 
                        square.dataset.selected = 'false';

                        if (isFullDayOccupied) {
                            // 100% OCUPADO (CINZA E SEM CLIQUE)
                            square.classList.add('border-gray-400', 'bg-gray-400', 'cursor-not-allowed', 'opacity-50');
                        } else if (slot.occupied_times.length > 0) {
                            // PARCIALMENTE OCUPADO (AMARELO)
                            square.classList.add('border-yellow-500', 'bg-yellow-500', 'hover:bg-yellow-600', 'cursor-pointer');
                        } else {
                            // LIVRE (VERDE)
                            square.classList.add('border-green-500', 'bg-green-500', 'hover:bg-green-600', 'cursor-pointer');
                        }
                        
                        // SÓ ADICIONA CLIQUE SE NÃO ESTIVER 100% OCUPADO
                        if (!isFullDayOccupied) {
                            square.addEventListener('click', async () => {
                                // --- ESTE É O CÓDIGO DO SEU LISTENER ORIGINAL ---
                                document.querySelectorAll('.vaga-square').forEach(otherSquare => {
                                    if (otherSquare.dataset.selected === 'true') {
                                        otherSquare.classList.remove('bg-indigo-600', 'border-indigo-600');
                                        
                                        // Restaura a cor original
                                        const otherSlotDate = otherSquare.dataset.slotDate;
                                        const otherSlotNumber = otherSquare.dataset.vagaNumber;
                                        const otherAvailability = data.dates_availability.find(av => av.date === otherSlotDate);
                                        const otherSlot = otherAvailability.slots.find(s => s.slot_number.toString() === otherSlotNumber);
                                        
                                        // (Lógica de 100% ocupado não é necessária aqui, pois ele não seria clicável)
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
                                // --- FIM DO CÓDIGO DO SEU LISTENER ORIGINAL ---
                            });
                        }

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
        window.currentSpotData = null;
        noSlotsMessageP.textContent = "Erro ao carregar disponibilidade das vagas. Verifique sua conexão ou tente novamente.";
        noSlotsMessageP.classList.remove('hidden');
    }
}

function stopQrScanner() {
    const modal = document.getElementById('qr-scanner-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    
    if (html5QrCodeScanner) {
        try {
            html5QrCodeScanner.stop().then(() => {
                console.log("Leitor de QR Code parado.");
                html5QrCodeScanner.clear(); // Limpa a memória
            }).catch(err => {
                console.warn("Falha ao parar o leitor de QR Code.", err);
            });
        } catch (e) {
            console.warn("Erro ao parar leitor:", e);
        }
    }
}

/**
 * Inicia o leitor de QR Code para fazer o check-in.
 * @param {object} reservation - O objeto da reserva que está sendo ativada.
 */
function startQrScanner(reservation) {
    const modal = document.getElementById('qr-scanner-modal');
    const closeBtn = document.getElementById('close-qr-scanner');
    const scanResultEl = document.getElementById('qr-scan-result');

    if (!modal || !closeBtn || !scanResultEl) {
        console.error("Elementos do modal de scanner não encontrados.");
        return;
    }

    scanResultEl.textContent = ''; // Limpa resultados antigos
    modal.classList.remove('hidden'); // Mostra o modal

    // Configura o botão de fechar
    closeBtn.onclick = stopQrScanner;

    // Função que será chamada quando o QR for lido com sucesso
    const onScanSuccess = (decodedText, decodedResult) => {
        console.log(`QR Code lido: ${decodedText}`);
        
        // PAUSA a câmera para o usuário não escanear 10x
        if (html5QrCodeScanner) {
            html5QrCodeScanner.pause();
        }
        
        // Valida o QR Code
        handleQrScanSuccess(decodedText, reservation);
    };

    // Função que será chamada em caso de erro
    const onScanFailure = (error) => {
        // Não faz nada, só continua tentando
    };

    // Inicializa o scanner
    html5QrCodeScanner = new Html5QrcodeScanner(
        "qr-reader", // ID da div que colocamos no HTML
        { fps: 10, qrbox: { width: 250, height: 250 } }, // Configs da câmera
        false // verbose
    );
    
    html5QrCodeScanner.render(onScanSuccess, onScanFailure);
}

/**
 * Valida o QR Code lido e processa o check-in.
 * @param {string} decodedText - O JSON lido do QR Code (ex: '{"spot_id": 45, "slot_number": 2}')
 * @param {object} reservation - O objeto da reserva do cliente
 */
async function handleQrScanSuccess(decodedText, reservation) {
    const scanResultEl = document.getElementById('qr-scan-result');
    let scannedData;

    // 1. Tenta decodificar o JSON
    try {
        scannedData = JSON.parse(decodedText);
        if (!scannedData.spot_id || !scannedData.slot_number) {
            throw new Error("QR Code inválido (faltando dados).");
        }
    } catch (e) {
        scanResultEl.textContent = "QR Code inválido!";
        setTimeout(() => {
            scanResultEl.textContent = '';
            if(html5QrCodeScanner) html5QrCodeScanner.resume();
        }, 2000);
        return;
    }

    // 2. Valida se o QR Code lido BATE com a reserva do cliente
    if (scannedData.spot_id !== reservation.spot.id || 
        scannedData.slot_number !== reservation.slot_number) {
        
        scanResultEl.textContent = "Erro: Este QR Code não pertence a esta reserva!";
        setTimeout(() => {
            scanResultEl.textContent = '';
            if(html5QrCodeScanner) html5QrCodeScanner.resume();
        }, 2000);
        return;
    }

    // 3. SUCESSO! O QR Code é o correto.
    scanResultEl.textContent = "QR Code correto! Validando...";
    stopQrScanner(); // Para a câmera e fecha o modal

    // --- 👇 ESTA É A MUDANÇA (SAI O ALERTA, ENTRA A API) 👇 ---
    
    // 4. Chamar a API de Backend para fazer o Check-in
    try {
        // Pega o CSRF token (necessário para POST no Django)
        // (Certifique-se que você tem a função getCookie() importada neste arquivo)
        const csrfToken = getCookie('csrftoken'); 

        const response = await fetch(`/parking/api/reservations/${reservation.id}/check-in/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Falha ao registrar o check-in no servidor.");
        }

        // Se chegou aqui, o backend retornou 200 OK
        console.log("Check-in realizado com sucesso!");
        
        // (Opcional: use seu modal de sucesso se tiver um)
        alert("Check-in realizado com sucesso!"); 
        
        // Fecha o modal de detalhes da reserva
        document.getElementById('reservation-detail-modal').classList.add('hidden');
        
        // Recarrega a lista de "Minhas Reservas" para mostrar o status "Ativa"
        carregarMinhasReservas(); 

    } catch (error) {
        console.error("Erro durante o check-in:", error);
        // (Opcional: use seu modal de erro se tiver um)
        alert(`Erro: ${error.message}`);
    }
    // --- 👆 FIM DA MUDANÇA 👆 ---
}

function openListDetailModal(list) {
    const modal = document.getElementById('favorite-list-detail-modal');
    const titleEl = document.getElementById('favorite-list-title');
    const listContainer = document.getElementById('favorite-list-spots-container');
    
    if (!modal || !titleEl || !listContainer) {
        console.error("Elementos do modal 'favorite-list-detail-modal' não encontrados.");
        return;
    }

    // 1. Preencher título e limpar lista
    titleEl.textContent = list.name;
    listContainer.innerHTML = ''; // Limpa resultados anteriores

    // 2. Verificar se as vagas globais (do mapa) estão carregadas
    if (!window.allSpots || window.allSpots.length === 0) {
        listContainer.innerHTML = '<p class="text-red-500 p-4">Erro: A lista de vagas não está carregada (window.allSpots). Tente recarregar a página.</p>';
        modal.classList.remove('hidden');
        return;
    }

    // 3. Verificar se a lista de favoritos tem vagas
    if (!list.spots || list.spots.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500 p-4">Você ainda não adicionou nenhuma vaga a esta lista.</p>';
        modal.classList.remove('hidden');
        return;
    }

    // 4. Iterar sobre as vagas salvas e renderizá-las
    list.spots.forEach(savedSpot => { // savedSpot é { id: "123", imageUrl: "..." }
        
        // Encontra o objeto completo da vaga na lista global
        const fullSpot = window.allSpots.find(s => String(s.id) === String(savedSpot.id));
        
        const card = document.createElement('div');
        
        if (fullSpot) {
            // --- Caso 1: A vaga foi encontrada ---
            card.className = "flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors";
            
            // AÇÃO PRINCIPAL: Abrir o modal de detalhes da vaga
            card.onclick = () => {
                modal.classList.add('hidden'); // Fecha o modal da lista
                openParkingDetailModal(fullSpot); // Abre o modal do spot
            };
            
            const photo = fullSpot.photos && fullSpot.photos.length > 0 ? fullSpot.photos[0] : '/static/parking/css/images/placeholder.png';
            
            card.innerHTML = `
                <img src="${photo}" alt="${fullSpot.title}" class="w-16 h-16 rounded-md object-cover">
                <div class="ml-3 flex-1 overflow-hidden">
                    <h6 class="font-semibold text-gray-800 truncate">${fullSpot.title}</h6>
                    <p class="text-sm text-gray-600 truncate">${fullSpot.address}</p>
                    <span class="font-bold text-sm text-indigo-600">R$ ${parseFloat(fullSpot.price_hour).toFixed(2).replace('.', ',')}/h</span>
                </div>
            `;
        } else {
            // --- Caso 2: A vaga foi favoritada mas não encontrada (ex: deletada) ---
            card.className = "flex items-center p-3 border border-dashed rounded-lg bg-gray-50 opacity-60";
            card.innerHTML = `
                <div class="w-16 h-16 rounded-md bg-gray-200 flex items-center justify-center">
                   <i class="fas fa-exclamation-triangle text-gray-400"></i>
                </div>
                <div class="ml-3">
                    <h6 class="font-semibold text-gray-500 italic">Vaga indisponível</h6>
                    <p class="text-sm text-gray-400">Esta vaga (ID: ${savedSpot.id}) pode ter sido removida.</p>
                </div>
            `;
        }
        listContainer.appendChild(card);
    });

    // 5. Mostrar o modal
    modal.classList.remove('hidden');
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

    document.getElementById("close-seller-profile-modal")?.addEventListener("click", () => {
        document.getElementById("seller-profile-modal").classList.add("hidden");
    });

    document.getElementById("close-favorite-list-detail-modal")?.addEventListener("click", () => {
        document.getElementById("favorite-list-detail-modal").classList.add("hidden");
    });
}