// static/parking/js/main.js

// Importando diretamente o que é necessário de cada arquivo
import { initMap, localizarUsuario, configurarBuscaEndereco, initializeAutocomplete, limparMarkers, adicionarMarkerSpot, map } from './map_utilities.js';
import { handleSubmitSpot, setupEditSpotForm } from './form_handlers.js';
import { openReservationModal, renderMySpot, renderSpot, setupModalClosers, activateTab, carregarSpotsDaListaEdoMapa } from './ui_handlers.js';
import { setupAvailabilityFields } from './availability_manager.js';
import { setupPhotoUpload } from './photo_upload.js';
import { fetchSpotDetails, deleteSpot, updateSpotStatus, fetchSpots, fetchMySpots } from './api_services.js';

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
                activateTab(button.dataset.tab);
            });
        });

        // 4. Ativar a aba padrão ('parkings') na carga inicial
        // Esta chamada vai disparar a inicialização do mapa e o carregamento dos spots.
        const initialTab = document.querySelector('.tab-btn[data-tab="parkings"]');
        if (initialTab) {
            await activateTab(initialTab.dataset.tab); // Use await para garantir a ordem
            console.log("main.js: Aba 'parkings' ativada e spots carregados.");
        } else {
            console.warn("main.js: Botão da aba 'parkings' não encontrado. Não foi possível ativar a aba inicial.");
        }

        // Event listener para marcadores do mapa (recebe do map_utilities)
        document.addEventListener("spotMarkerClicked", (event) => {
            openReservationModal(event.detail); // Usa a função importada
        });

        // Event listener para abrir modal de reserva (clique no card da lista)
        document.addEventListener("click", async (e) => {
            const btn = e.target.closest(".open-reservation-modal");
            if (!btn) return;

            const spotId = btn.dataset.spotId;
            // É crucial que window.allSpots seja atualizado por carregarSpotsDaListaEdoMapa
            const spot = window.allSpots?.find((s) => s.id == spotId); // Assume que allSpots é global
            if (spot) {
                openReservationModal(spot);
            } else {
                console.warn(`Spot com ID ${spotId} não encontrado em allSpots. Tentando buscar detalhes...`);
                try {
                    const fetchedSpot = await fetchSpotDetails(spotId);
                    if (fetchedSpot) {
                        openReservationModal(fetchedSpot);
                    } else {
                        console.error(`Não foi possível encontrar ou buscar detalhes para o spot ID: ${spotId}`);
                        alert("Detalhes da vaga não encontrados.");
                    }
                } catch (error) {
                    console.error("Erro ao buscar detalhes do spot:", error);
                    alert("Erro ao carregar detalhes da vaga.");
                }
            }
        });

        console.log("main.js: Inicialização completa.");

    } catch (error) {
        console.error("main.js: Erro fatal na inicialização da aplicação:", error);
    }
}

// Garante que a aplicação inicie APENAS UMA VEZ após o DOM estar completamente carregado
document.addEventListener('DOMContentLoaded', initializeApplication);