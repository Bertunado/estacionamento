// map_utilities.js

export let map; // Declara o mapa exportado
export let MarkerClass; // Declara a classe do marcador exportada (AdvancedMarkerElement ou Marker)

let MapClass;
let GeocoderClass;
let PlacesServiceClass;
let AutocompleteClass;
let SearchBoxClass;

window.userMarker = null;
window.spotMarkers = {};
window.autocompleteInicializado = false;


export function limparMarkers() {
    if (window.spotMarkers) {
        
        Object.values(window.spotMarkers).forEach(marker => marker.map = null);
        window.spotMarkers = {}; // Reinicializa o objeto de marcadores
    }
}


export function adicionarMarkerSpot(spot) {
    if (!map || !MarkerClass) {
        console.warn("adicionarMarkerSpot: Mapa ou MarkerClass (AdvancedMarkerElement) não disponíveis.");
        return null;
    }

    // Remove o marcador antigo se ele existir para evitar duplicatas
    if (window.spotMarkers[spot.id]) {
        window.spotMarkers[spot.id].map = null; // Desvincula do mapa para Advanced Markers
        delete window.spotMarkers[spot.id];
    }

    const position = { lat: Number(spot.latitude), lng: Number(spot.longitude) };

    // Criando um elemento personalizado para o ícone
    const markerContent = document.createElement('div');
    markerContent.className = 'custom-marker-spot'; // Classe para estilizar este marcador específico
    markerContent.innerHTML = `<i class="fas fa-map-marker-alt text-indigo-600 text-3xl"></i>`;

    const marker = new MarkerClass({ // Usando MarkerClass (que será AdvancedMarkerElement)
        map: map, // Usando a variável 'map' exportada
        position: position,
        title: spot.title,
        content: markerContent,
        gmpDraggable: false, 
    });

    // Dispara um evento customizado que ui_handlers.js pode ouvir
    marker.addListener("click", () => {
        document.dispatchEvent(new CustomEvent("spotMarkerClicked", { detail: spot }));
    });

    window.spotMarkers[spot.id] = marker;
    return marker;
}

export function geocode(address) {
    return new Promise((resolve) => {
        if (!GeocoderClass) {
            console.error("GeocoderClass não disponível para geocode.");
            resolve(null);
            return;
        }
        const geocoder = new GeocoderClass();
        geocoder.geocode({ address }, (results, status) => {
            if (status === "OK" && results[0]) {
                const loc = results[0].geometry.location;
                resolve({ lat: loc.lat(), lng: loc.lng() });
            } else {
                resolve(null);
            }
        });
    });
}

export function localizarUsuario() {
    if (!navigator.geolocation || !map || !MarkerClass) { // Usando 'map' exportado
        console.warn("Geolocalização não disponível, mapa ou MarkerClass não inicializados para localizar usuário.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const you = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            map.setCenter(you); // Usando 'map' exportado

            if (!window.userMarker) {
                const userMarkerContent = document.createElement('div');
                userMarkerContent.className = 'custom-marker-user';
                userMarkerContent.innerHTML = `<i class="fas fa-dot-circle text-blue-600 text-2xl"></i>`; // Ícone para usuário

                window.userMarker = new MarkerClass({ // Usando MarkerClass
                    map: map, // Usando 'map' exportado
                    position: you,
                    title: "Você está aqui",
                    content: userMarkerContent,
                });
            } else {
                window.userMarker.position = you; // Atualiza a posição para AdvancedMarkerElement
            }
        },
        (error) => console.warn("Geolocalização negada ou indisponível:", error.message)
    );
}

export function configurarBuscaEndereco() {
    const btn = document.getElementById("buscarCepBtn");
    const input = document.getElementById("cepInput");
    if (!btn || !input || !map || !SearchBoxClass || !MarkerClass) { // Usando 'map' exportado
        console.warn("Elementos de busca de endereço não encontrados, mapa, SearchBoxClass ou MarkerClass não inicializados.");
        return;
    }

    if (!window.searchBoxInstance) {
        window.searchBoxInstance = new SearchBoxClass(input);

        window.searchBoxInstance.addListener('places_changed', async () => {
            const places = window.searchBoxInstance.getPlaces();
            if (places.length == 0) return;

            const bounds = new google.maps.LatLngBounds();
            places.forEach((place) => {
                if (!place.geometry || !place.geometry.location) return;
                if (place.geometry.viewport) {
                    bounds.union(place.geometry.viewport);
                } else {
                    bounds.extend(place.geometry.location);
                }
            });
            map.fitBounds(bounds); // Usando 'map' exportado

            if (places[0] && places[0].geometry && places[0].geometry.location) {
                if (window.searchLocationMarker) {
                    window.searchLocationMarker.map = null;
                }
                const searchMarkerContent = document.createElement('div');
                searchMarkerContent.className = 'custom-marker-search';
                searchMarkerContent.innerHTML = `<i class="fas fa-search-location text-purple-600 text-3xl"></i>`;
                
                window.searchLocationMarker = new MarkerClass({
                    map: map,
                    position: places[0].geometry.location,
                    title: places[0].name || places[0].formatted_address,
                    content: searchMarkerContent,
                });
            }
        });
    }

    if (!window.buscarCepBtnListener) {
        btn.addEventListener("click", async () => {
            const address = input.value.trim();
            if (!address) return alert("Digite um CEP ou endereço para buscar.");

            const location = await geocode(address);
            if (!location) return alert("Endereço não encontrado.");

            map.setCenter(location); // Usando 'map' exportado
            map.setZoom(15); // Usando 'map' exportado

            // Remova o marcador anterior de busca se houver
            if (window.searchLocationMarker) {
                window.searchLocationMarker.map = null;
            }
            const searchMarkerContent = document.createElement('div');
            searchMarkerContent.className = 'custom-marker-search';
            searchMarkerContent.innerHTML = `<i class="fas fa-search-location text-purple-600 text-3xl"></i>`;
            
            window.searchLocationMarker = new MarkerClass({
                map: map, // Usando 'map' exportado
                position: location,
                title: address,
                content: searchMarkerContent,
            });
        });
        window.buscarCepBtnListener = true;
    }
}

export function initializeAutocomplete() {
    const input = document.getElementById("addressInput");
    if (!input || !map || !AutocompleteClass || !MarkerClass) { // Usando 'map' exportado
        console.warn("Elemento 'addressInput' não encontrado, mapa, AutocompleteClass ou MarkerClass não inicializados para autocomplete.");
        return;
    }
    if (window.autocompleteInicializado) {
        console.log("Autocomplete já inicializado.");
        return;
    }

    const autocomplete = new AutocompleteClass(input);
    autocomplete.bindTo("bounds", map); // Usando 'map' exportado

    autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();

        if (!place.geometry) {
            alert("Local não encontrado");
            return;
        }

        const latInput = document.getElementById("latInput");
        const lngInput = document.getElementById("lngInput");

        if (latInput) latInput.value = place.geometry.location.lat();
        if (lngInput) lngInput.value = place.geometry.location.lng();

        map.setCenter(place.geometry.location); // Usando 'map' exportado
        map.setZoom(15); // Usando 'map' exportado

        if (window.userMarker) {
            window.userMarker.position = place.geometry.location; // Atualiza a posição para AdvancedMarkerElement
        } else {
            const addParkingMarkerContent = document.createElement('div');
            addParkingMarkerContent.className = 'custom-marker-add-parking';
            addParkingMarkerContent.innerHTML = `<i class="fas fa-map-pin text-green-600 text-3xl"></i>`; // Ícone para "adicionar vaga"

            window.userMarker = new MarkerClass({ // Usando MarkerClass
                map: map, // Usando 'map' exportado
                position: place.geometry.location,
                gmpDraggable: true, // Advanced Markers usam gmpDraggable
                title: "Local da Vaga",
                content: addParkingMarkerContent, 
            });
            window.userMarker.addListener('dragend', () => {
                const newPos = window.userMarker.position; // Posição para AdvancedMarkerElement
                if (latInput) latInput.value = newPos.lat();
                if (lngInput) lngInput.value = newPos.lng();
            });
        }
    });
    window.autocompleteInicializado = true;
}

export async function carregarSpots(spots) { // Recebe 'spots' como argumento
    try {
        if (!map || !MarkerClass) { // Usando 'map' exportado
            console.error("Mapa ou MarkerClass não inicializados. Não foi possível carregar os spots.");
            return;
        }
        limparMarkers(); // Limpa TODOS os marcadores existentes
        if (spots && spots.length > 0) {
            spots.forEach(spot => {
                adicionarMarkerSpot(spot);
            });
        }
        console.log(`Carregados ${spots ? spots.length : 0} spots no mapa.`);
    } catch (error) {
        console.error("Erro ao carregar spots para o mapa:", error);
    }
}

export async function initMap() {
    console.log("initMap: Iniciando carregamento de bibliotecas do Google Maps...");
    try {
        if (map) { // Usando 'map' exportado
            console.log("initMap: Mapa já existe, não reinicializando.");
            localizarUsuario(); // Atualiza a localização do usuário no mapa existente
            return;
        }

        const mapsLib = await google.maps.importLibrary("maps");
        MapClass = mapsLib.Map;
        // Tenta usar AdvancedMarkerElement, fallback para Marker clássico se não disponível/ativado
        MarkerClass = (await google.maps.importLibrary("marker")).AdvancedMarkerElement || mapsLib.Marker;

        const placesLib = await google.maps.importLibrary("places");
        PlacesServiceClass = placesLib.PlacesService;
        AutocompleteClass = placesLib.Autocomplete;
        SearchBoxClass = placesLib.SearchBox; 

        const geocodingLib = await google.maps.importLibrary("geocoding");
        GeocoderClass = geocodingLib.Geocoder;

        console.log("initMap: Bibliotecas Google Maps carregadas.");

        const mapElement = document.getElementById("map");
        if (!mapElement) {
            console.error("initMap: Elemento #map não encontrado no DOM. O mapa não pode ser inicializado.");
            throw new Error("Elemento do mapa não encontrado.");
        }

        // Tenta obter a localização atual do usuário como centro inicial
        let initialLat = -26.3026; // Latitude padrão (Joinville, SC)
        let initialLng = -48.8475; // Longitude padrão (Joinville, SC)
        try {
            const position = await new Promise((resolve, reject) => {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                } else {
                    reject("Geolocation is not supported by this browser.");
                }
            });
            initialLat = position.coords.latitude;
            initialLng = position.coords.longitude;
            console.log("initMap: Localização atual obtida:", initialLat, initialLng);
        } catch (error) {
            console.warn("initMap: Erro ao obter localização atual ou não suportado. Usando localização padrão.", error);
        }

        map = new MapClass(mapElement, {
            center: { lat: initialLat, lng: initialLng }, // Usando a localização obtida ou padrão
            zoom: 15, // Zoom um pouco maior para a localização inicial
            mapId: "78fe22b3d0432217499196a4", // ID do mapa
            mapTypeId: "roadmap",
            disableDefaultUI: true, // Para ter controle manual dos controles
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
        });
        console.log("initMap: Mapa principal inicializado.");

        localizarUsuario(); // Chama a função para adicionar o marcador do usuário

        console.log("initMap: Funções dependentes do mapa chamadas (pós-inicialização).");

    } catch (error) {
        console.error("initMap: Erro fatal ao inicializar o mapa ou carregar bibliotecas:", error);
        const mapElement = document.getElementById("map");
        if (mapElement) {
            mapElement.innerHTML = "<p class='text-red-500 text-center p-4'>Não foi possível carregar o mapa. Por favor, verifique sua conexão, chave da API ou Map ID.</p>";
        }
    }
}
