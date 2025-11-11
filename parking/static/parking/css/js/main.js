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
    handleReservationAction // 👇 Importe a nova função
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
// Não precisamos importar as novas funções da API aqui, pois elas são usadas pelo ui_handlers

async function initializeApplication() {
    console.log("main.js: Inicializando aplicação...");
    try {
        // 1. Configurar elementos do DOM e event listeners que não dependem do mapa
        const form = document.getElementById("addParkingForm");
        if (form) form.addEventListener("submit", handleSubmitSpot);

        setupAvailabilityFields();
        setupPhotoUpload();
        setupModalClosers(); // Configura os fechadores de modais

        document.getElementById("logoutBtn")?.addEventListener("click", () =>
            alert("Você foi desconectado.")
        );

        // 2. Inicializar o mapa e aguardar sua conclusão
        await initMap();
        console.log("main.js: Mapa base inicializado e pronto.");

        // 3. Configurar event listeners para as abas
        // Estes listeners dependem do mapa ter sido inicializado (especialmente a aba 'parkings')
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // A mágica acontece aqui! O activateTab (em ui_handlers.js)
                // vai carregar o conteúdo da aba correta, incluindo a nova 'requests'
                activateTab(button.dataset.tab);
            });
        });

        // 4. Ativar a aba padrão ('parkings') na carga inicial
        const initialTab = document.querySelector('.tab-btn[data-tab="parkings"]');
        if (initialTab) {
            await activateTab(initialTab.dataset.tab); 
            console.log("main.js: Aba 'parkings' ativada e spots carregados.");
        } else {
            console.warn("main.js: Botão da aba 'parkings' não encontrado. Não foi possível ativar a aba inicial.");
        }

        // Event listener para marcadores do mapa (recebe do map_utilities)
        document.addEventListener("spotMarkerClicked", (event) => {
            openParkingDetailModal(event.detail); 
        });

        // 5. Event listener DE CLIQUE GLOBAL (MODIFICADO)
        // Combinamos os listeners de clique aqui
        document.addEventListener("click", async (e) => {
            
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
                
                // (Assumindo que showConfirmationModal está em confirmations.js ou ui_handlers.js e é global ou importado em ui_handlers)
                showConfirmationModal(`Tem certeza que deseja ${actionText} esta reserva?`, () => {
                    handleReservationAction(id, action); // Chama a função do ui_handlers
                });
                return; // Encerra após tratar o clique
            }
        });

        console.log("main.js: Inicialização completa.");

    } catch (error) {
        console.error("main.js: Erro fatal na inicialização da aplicação:", error);
    }
}

// Garante que a aplicação inicie APENAS UMA VEZ após o DOM estar completamente carregado
document.addEventListener('DOMContentLoaded', initializeApplication);