// Este arquivo contem as variáveis e constantes globais

export let selectedVaga = null;
export const uploadedFiles = [];
export let userMarker = null;
export let spotMarkers = {};
export let map = null; // O mapa precisa ser global para ser acessado por outras funções
export let allSpots = []; // Para armazenar todas as vagas carregadas
export let autocompleteInicializado = false;
export const previewContainer = document.getElementById('preview-container');
export function setMap(newMap) { map = newMap; }
export function setAllSpots(spots) { allSpots = spots; }
export function setAutocompleteInitialized(status) { autocompleteInicializado = status; }
export const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
if (!csrfToken) {
  console.error('CSRF token não encontrado no HTML. Verifique se a meta tag está presente.');
}

// 3. Lógica de Favoritos (MEMÓRIA)

// Primeiro, tentamos ler do localStorage. Se der erro ou for vazio, usamos array vazio.
let initialFavorites = [];
try {
    const stored = localStorage.getItem('parkShareFavorites');
    if (stored) {
        initialFavorites = JSON.parse(stored);
    }
} catch (e) {
    console.error("Erro ao ler favoritos do localStorage:", e);
    initialFavorites = [];
}

// Inicia o Set com esses dados e EXPORTA para outros arquivos usarem
export const favoritedSpotIds = new Set(initialFavorites);

// Função para salvar no navegador
export function saveFavoritesToStorage() {
    // O localStorage só salva texto, então convertemos o Set para Array e depois para JSON
    const arrayToSave = Array.from(favoritedSpotIds);
    localStorage.setItem('parkShareFavorites', JSON.stringify(arrayToSave));
}