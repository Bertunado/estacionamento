// static/parking/js/globals.js

// 1. Array para armazenar os arquivos de imagem selecionados (para upload)
export const uploadedFiles = []; 

// 2. Token CSRF (para requisições POST)
export const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
if (!csrfToken) {
  console.error('CSRF token não encontrado no HTML. Verifique se a meta tag está presente.');
}

// 3. LÓGICA DE FAVORITOS (COM LISTAS/GRUPOS)
//    (Esta parte está correta e pronta para o modal de listas)

// Estrutura Padrão: Se não tiver nada salvo, cria "Meus Favoritos"
const defaultLists = [
    { id: 'default', name: 'Meus Favoritos', spots: [] } // 'spots' guarda objetos { id, imageUrl }
];

// Tenta carregar do LocalStorage
let storedLists = JSON.parse(localStorage.getItem('parkShareLists'));

// Se não existir ou estiver corrompido, usa o padrão
if (!storedLists || !Array.isArray(storedLists) || storedLists.length === 0) {
    storedLists = defaultLists;
}

// Exporta a variável que o ui_handlers.js vai usar
export let favoriteLists = storedLists;

// Função para salvar as alterações
export function saveListsToStorage() {
    localStorage.setItem('parkShareLists', JSON.stringify(favoriteLists));
}

// Função auxiliar para saber se o coração deve ficar vermelho
export function isSpotFavorited(spotId) {
    return favoriteLists.some(list => 
        list.spots.some(spotItem => 
            String(spotItem.id) === String(spotId) || parseInt(spotItem.id) === parseInt(spotId)
        )
    );
}