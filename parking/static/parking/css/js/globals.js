// Este arquivo contem as variáveis e constantes globais

export let selectedVaga = null;
export let uploadedFiles = [];
export let userMarker = null;
export let spotMarkers = {};
export let map = null; // O mapa precisa ser global para ser acessado por outras funções
export let allSpots = []; // Para armazenar todas as vagas carregadas
export let autocompleteInicializado = false;
export const previewContainer = document.getElementById('preview-container');
export function setMap(newMap) { map = newMap; }
export function setAllSpots(spots) { allSpots = spots; }
export function setAutocompleteInitialized(status) { autocompleteInicializado = status; }
export const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
if (!csrfToken) {
  console.error('CSRF token não encontrado no HTML. Verifique se a meta tag está presente.');
}
