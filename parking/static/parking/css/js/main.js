// static/parking/js/main.js

// Importando diretamente o que é necessário de cada arquivo
import { initMap, localizarUsuario, configurarBuscaEndereco, initializeAutocomplete, limparMarkers, adicionarMarkerSpot, map } from './map_utilities.js';
import { handleSubmitSpot, setupEditSpotForm } from './form_handlers.js';
import { 
    openParkingDetailModal, 
    renderMySpot, 
    renderSpot, 
    setupModalClosers, 
    activateTab, 
    openReservationDetailModal, 
    carregarSpotsDaListaEdoMapa,
    handleReservationAction,
    toggleParkingSheet,
    setupFavoritesLogic 
} from './ui_handlers.js';
import { setupAvailabilityFields } from './availability_manager.js';
import { setupPhotoUpload } from './photo_upload.js';
import { 
    fetchSpotDetails, 
    deleteSpot, 
    updateSpotStatus, 
    fetchSpots, 
    fetchMySpots 
} from './api_services.js';

import { showConfirmationModal } from './confirmations.js';
// Não precisamos importar as novas funções da API aqui, pois elas são usadas pelo ui_handlers
let resizeTimer;
let isMobile = window.innerWidth < 768;

// --- LÓGICA DE DETECÇÃO DE REDIMENSIONAMENTO ---

window.addEventListener('resize', () => {
    // Limpa o timer anterior para não rodar o código mil vezes
    clearTimeout(resizeTimer);
    
    // Cria um novo timer. O código só roda 250ms *depois* que o usuário PARAR de redimensionar.
    resizeTimer = setTimeout(() => {
        const newIsMobile = window.innerWidth < 768;
        
        // O código só roda se o estado mudou (ex: de celular para desktop)
        if (newIsMobile !== isMobile) {
            console.log(`Breakpoint cruzado! Novo estado: ${newIsMobile ? 'Mobile' : 'Desktop'}`);
            isMobile = newIsMobile; // Atualiza o estado
            
            // Verifica se a aba "Vagas" é a que está ativa
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab && activeTab.id === 'parkings') {
                
                // Se for, re-chama o activateTab para redesenhar o mapa no lugar certo!
                console.log("Re-ativando 'parkings' para o novo tamanho de tela.");
                activateTab('parkings');
            }
        }
    }, 250); 
});

async function initializeApplication() {
    console.log("main.js: Inicializando aplicação...");
    try {
        // 1. Configurar elementos do DOM e event listeners que não dependem do mapa
        const form = document.getElementById("addParkingForm");
        if (form) form.addEventListener("submit", handleSubmitSpot);

        setupAvailabilityFields();
        setupPhotoUpload();
        setupModalClosers(); // Configura os fechadores de modais
        setupFavoritesLogic();

        document.getElementById("logoutBtn")?.addEventListener("click", () =>
            alert("Você foi desconectado.")
        );

        // 2. REMOVIDA A CHAMADA DE initMap() DAQUI.
        //    O mapa SÓ deve ser inicializado pelo activateTab.

        // 3. Configurar event listeners para as abas
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                activateTab(button.dataset.tab);
            });
        });

        // 4. Ativar a aba padrão ('parkings') na carga inicial
        // Esta chamada agora é a ÚNICA responsável por carregar o mapa.
        const initialTab = document.querySelector('.tab-btn[data-tab="parkings"]');
        if (initialTab) {
            await activateTab(initialTab.dataset.tab); 
            console.log("main.js: Aba 'parkings' ativada e spots carregados.");
        } else {
            // Se não houver abas (ex: em 'verificar_codigo.html'), 
            // vamos tentar carregar o mapa do celular por padrão, se ele existir.
            if (document.getElementById('map')) {
                 await activateTab('parkings');
            } else {
                 console.warn("main.js: Botão da aba 'parkings' não encontrado. Não foi possível ativar a aba inicial.");
            }
        }

        // 5. Event listener para marcadores do mapa
        document.addEventListener("spotMarkerClicked", (event) => {
            openParkingDetailModal(event.detail); 
        });

        // 5. Event listener DE CLIQUE GLOBAL (MODIFICADO)
        // Combinamos os listeners de clique aqui
        document.addEventListener("click", async (e) => {

            const mobileBtn = e.target.closest(".mobile-nav-btn");
    if (mobileBtn) {
        e.preventDefault();
        const tabId = mobileBtn.dataset.tab;
        activateTab(tabId); // (Função do ui_handlers.js)
        return;
    }

    // --- Lógica para o BOTÃO DE PERFIL MÓVEL (que abre o pop-up) ---
    const profileMenuBtn = e.target.closest("#profile-menu-btn");
    if (profileMenuBtn) {
        e.preventDefault();
        document.getElementById("profile-menu-modal").classList.toggle("hidden");
        return;
    }

    // --- Lógica para as OPÇÕES DO POP-UP DE PERFIL ---
    const profileMenuOption = e.target.closest(".profile-menu-option");
    if (profileMenuOption) {
        e.preventDefault();
        const tabId = profileMenuOption.dataset.tab;
        activateTab(tabId); // Ativa a aba
        document.getElementById("profile-menu-modal").classList.add("hidden"); // Esconde o modal
        return;
    }

    const sheetHandle = e.target.closest("#sheet-handle");
    if (sheetHandle) {
        // (Assumindo que a função está em ui_handlers.js)
        toggleParkingSheet(); 
        return;
    }
    
    // Esconde o pop-up de perfil se clicar em qualquer outro lugar
    const profileModal = document.getElementById("profile-menu-modal");
    if (profileModal && !profileModal.classList.contains("hidden") && !e.target.closest("#profile-menu-btn")) {
        profileModal.classList.add("hidden");
    }
            
            // Lógica para abrir modal de reserva (clique no card da lista)
            const openModalBtn = e.target.closest(".open-reservation-modal");
            if (openModalBtn) {
                const spotId = openModalBtn.dataset.spotId;
                const spot = window.allSpots?.find((s) => s.id == spotId);
                if (spot) {
                    openParkingDetailModal(spot);
                } else {
                    console.warn(`Spot com ID ${spotId} não encontrado. Tentando buscar...`);
                    try {
                        const fetchedSpot = await fetchSpotDetails(spotId);
                        if (fetchedSpot) openParkingDetailModal(fetchedSpot);
                        else alert("Detalhes da vaga não encontrados.");
                    } catch (error) {
                        console.error("Erro ao buscar detalhes do spot:", error);
                        alert("Erro ao carregar detalhes da vaga.");
                    }
                }
                return; // Encerra após tratar o clique
            }

            // 👇 LÓGICA ADICIONADA PARA BOTÕES DE APROVAR/RECUSAR
            const actionBtn = e.target.closest(".action-btn");
        if (actionBtn) {
            const id = actionBtn.dataset.id;
            const action = actionBtn.dataset.action;
            const actionText = action === 'approve' ? 'aprovar' : 'recusar';
            
            const confirmButtonText = action === 'approve' ? 'Sim, aprovar' : 'Sim, recusar';

            // --- 🚀 ADICIONADO AQUI ---
            // Define o estilo baseado na ação
    	    const style = (action === 'approve') ? 'primary' : 'danger';
            // --- FIM DA ADIÇÃO ---
            
            showConfirmationModal(
                `Tem certeza que deseja ${actionText} esta reserva?`, // 1. Mensagem
                confirmButtonText,                                     // 2. Texto do Botão
                () => { handleReservationAction(id, action); },         // 3. Ação (Callback)
                style                                                  // 4. Estilo (NOVO)
            );
            return;
        }
        });

        console.log("main.js: Inicialização completa.");

    } catch (error) {
        console.error("main.js: Erro fatal na inicialização da aplicação:", error);
    }
}

// Garante que a aplicação inicie APENAS UMA VEZ após o DOM estar completamente carregado
document.addEventListener('DOMContentLoaded', initializeApplication);