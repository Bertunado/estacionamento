
// Importante: Este arquivo NÃO é um módulo ES6.
// Ele define a função global initMap que será chamada pelo Google Maps API.


// A FUNÇÃO initMap DEVE SER GLOBAL
window.initMap = function() { 
    console.log("initMap foi chamada! Inicializando mapa...");

    if (!window.google || !window.google.maps) {
        console.error("Google Maps API não carregou completamente. Tente recarregar a página.");
        return;
    }

    const defaultCenter = { lat: -23.55052, lng: -46.633308 }; // Centro padrão (ex: São Paulo)

    if (!window.map) { // Crie o mapa se ele ainda não existe (de globals.js)
        window.map = new google.maps.Map(document.getElementById("map"), {
            zoom: 13,
            center: defaultCenter,
        });
    } else {
        window.map = new google.maps.Map(document.getElementById("map"), {
            zoom: 13,
            center: defaultCenter,
        });
    }
    if (typeof window.localizarUsuario === 'function') {
        window.localizarUsuario();
    } else {
        console.warn("função localizarUsuario não global ou não carregada.");
    }
    if (typeof window.carregarSpots === 'function') {
        window.carregarSpots(); // Chama o carregarSpots global
    } else {
        console.warn("função carregarSpots não global ou não carregada.");
    }
    if (typeof window.configurarBuscaEndereco === 'function') {
        window.configurarBuscaEndereco();
    } else {
        console.warn("função configurarBuscaEndereco não global ou não carregada.");
    }
    if (typeof window.initializeAutocomplete === 'function') {
        window.initializeAutocomplete();
    } else {
        console.warn("função initializeAutocomplete não global ou não carregada.");
    }

    console.log("Mapa e funções iniciais do mapa configurados.");
};
