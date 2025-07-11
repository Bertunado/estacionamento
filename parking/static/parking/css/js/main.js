let map;
const csrfToken = getCookie("csrftoken");
// --------------- INICIALIZAÇÃO DO MAPA E AUTOCOMPLETE --------------------
window.initMap = () => {
  const defaultCenter = { lat: -23.55052, lng: -46.633308 };

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 13,
    center: defaultCenter,
  });

  localizarUsuario();
  carregarSpots();
  configurarBuscaEndereco();
  initializeAutocomplete();
};

// --------------- LOCALIZA O USUÁRIO ------------------------------------
function localizarUsuario() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const you = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.setCenter(you);
      new google.maps.Marker({
        map,
        position: you,
        title: "Você está aqui",
        icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
      });
    },
    () => console.warn("Geolocalização negada ou indisponível")
  );
}

// --------------- CARREGA VAGAS DO BACKEND ------------------------------
function carregarSpots() {
  fetch("/parking/api/spots/")
    .then(r => r.json())
    .then(data => {
      const spots = data.results || data; // se for paginado, pega results, se não, pega data direto
      spots.forEach(renderSpot);
    })
    .catch(err => console.error("Falha ao buscar vagas:", err));
}

// --------------- BUSCA POR CEP / ENDEREÇO ------------------------------
function configurarBuscaEndereco() {
  const btn = document.getElementById("buscarCepBtn");
  const input = document.getElementById("cepInput");
  if (!btn || !input) return;

  btn.addEventListener("click", () => {
    const address = input.value.trim();
    if (!address) return alert("Digite um CEP ou endereço.");

    geocode(address).then((loc) => {
      if (!loc) return alert("Endereço não encontrado.");
      map.setCenter(loc);
      map.setZoom(15);
      new google.maps.Marker({ map, position: loc, title: address });
    });
  });
}

// --------------- AUTOCOMPLETE NO ENDEREÇO ------------------------------
function initializeAutocomplete() {
  const input = document.getElementById("addressInput");
  if (!input) return;

  const autocomplete = new google.maps.places.Autocomplete(input);

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();

    if (!place.geometry) {
      console.log("Local não encontrado");
      return;
    }

    document.getElementById("latInput").value = place.geometry.location.lat();
    document.getElementById("lngInput").value = place.geometry.location.lng();

    // Atualiza o mapa para o local selecionado
    map.setCenter(place.geometry.location);
    map.setZoom(15);
  });
}

// --------------- FORMULÁRIO "DIVULGAR VAGA" ---------------------------
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("addParkingForm");
  if (form) form.addEventListener("submit", handleSubmitSpot);

  // Abas
  document.querySelectorAll(".tab-btn").forEach((btn) =>
    btn.addEventListener("click", () => switchTab(btn))
  );

  document.getElementById("logoutBtn")?.addEventListener("click", () =>
    alert("Você foi desconectado.")
  );

  console.log("main.js carregado ✅");
});

async function handleSubmitSpot(e) {
  e.preventDefault();
  const form = e.target;

  const formData = new FormData(form);
  const title = formData.get("title")?.trim();
  const address = formData.get("address")?.trim();
  const price_hour = formData.get("price_hour") || "0";
  const price_day = formData.get("price_day") || "0";
  const size = formData.get("size") || "Indefinido";
  const covered = formData.get("covered") === "true";
  const description = formData.get("description")?.trim();

  if (!title || !address) {
    alert("Preencha título e endereço.");
    return;
  }

  if (!description) {
    alert("Preencha a descrição.");
    return;
  }

  // Geocodifica o endereço para lat/lng
  const loc = await geocode(address);
  if (!loc) {
    alert("Endereço inválido ou não encontrado.");
    return;
  }

  const latitude = Number(loc.lat.toFixed(6));
  const longitude = Number(loc.lng.toFixed(6));

  const payload = {
    title,
    address,
    latitude,
    longitude,
    price_hour,
    price_day,
    size,
    covered,
    description,
  };

  // CSRF token já definido abaixo
  const resp = await fetch("/parking/api/spots/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Falha no POST:", resp.status, errText);
    alert("Erro ao salvar vaga:\n" + errText);
    return;
  }

  const spot = await resp.json();
  alert("Vaga publicada com sucesso!");
  form.reset();
  renderSpot(spot);
  renderMySpot(spot);
}

// --------------- HELPERS ----------------------------------------------
function geocode(address) {
  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status === "OK" && results[0]) {
        const l = results[0].geometry.location;
        resolve({ lat: l.lat(), lng: l.lng() });
      } else resolve(null);
    });
  });
}

  function renderSpot(spot) {
  if (window.map) {
    new google.maps.Marker({
      map,
      position: { lat: Number(spot.latitude), lng: Number(spot.longitude) },
      title: spot.title,
      icon: {
        url: "/static/parking/css/images/marcador.png",
        scaledSize: new google.maps.Size(55, 55) 
      }
    });
  }

  const list = document.querySelector("#parkings .overflow-y-auto");
  if (!list) return;

  const card = document.createElement("div");
  card.className = "border border-gray-200 rounded-lg p-3 hover:bg-gray-50 mb-2";
  card.innerHTML = `
    <div class="flex justify-between">
      <h4 class="font-medium">${spot.title}</h4>
      <span class="text-sm text-gray-500">${spot.covered ? "Coberta" : "Descoberta"}</span>
    </div>
    <p class="text-sm text-gray-600 mt-1">${spot.address}</p>
    <p class="text-sm text-gray-600 mt-1">R$ ${spot.price_hour}/h | R$ ${spot.price_day}/dia</p>
  `;
  list.prepend(card);
}

// --------------- TROCA DE ABAS ------------------------------------------
function switchTab(btn) {
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("border-indigo-600", b === btn);
    b.classList.toggle("text-indigo-600", b === btn);
    b.classList.toggle("text-gray-500", b !== btn);
    if (btn.dataset.tab === "my-parkings") {
      carregarMinhasVagas();  // ✅ chama aqui quando o usuário abre "Minhas Vagas"
}
  });

  document.querySelectorAll(".tab-content").forEach((c) => {
    c.classList.toggle("active", c.id === btn.dataset.tab);
  });

  // Inicializa autocomplete só na aba "add-parking", e só uma vez
  if (btn.dataset.tab === "add-parking" && !window.autocompleteInicializado) {
    setTimeout(() => {
      initializeAutocomplete();
      window.autocompleteInicializado = true;
    }, 100);
  }
}

// --------------- PEGAR CSRF TOKEN ----------------------------------------
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(name + "=")) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

function renderMySpot(spot) {
  const container = document.getElementById("myVagasContainer");
  if (!container) return;

  const card = document.createElement("div");
  card.className = "border border-gray-200 rounded-lg p-4";

  card.innerHTML = `
    <div class="flex justify-between items-center">
      <div>
        <h3 class="font-semibold text-lg text-gray-800">${spot.title}</h3>
        <p class="text-sm text-gray-500">${spot.address}</p>
        <p class="text-sm text-gray-500 mt-1">R$ ${spot.price_hour}/hora ou R$ ${spot.price_day}/dia</p>
      </div>
      <div>
        <span class="text-green-600 bg-green-100 text-sm px-2 py-1 rounded">Ativa</span>
      </div>
    </div>

    <div class="mt-3 flex items-center justify-between">
      <div class="flex space-x-2">
        <button class="bg-indigo-600 text-white px-3 py-1 text-sm rounded hover:bg-indigo-700">Editar</button>
        <button class="bg-gray-100 text-gray-800 px-3 py-1 text-sm rounded hover:bg-gray-200">Ver Estatísticas</button>
        <button class="bg-red-100 text-red-600 px-3 py-1 text-sm rounded hover:bg-red-200">Desativar</button>
        <button class="bg-red-100 text-red-600 px-3 py-1 text-sm rounded hover:bg-red-200">Excluir</button>
      </div>
    </div>
  `;

  container.prepend(card);
}

function carregarMinhasVagas() {
  const container = document.getElementById("myVagasContainer");
  if (!container) return;

  fetch("/parking/api/minhas-vagas/")
    .then(r => r.json())
    .then(vagas => {
      container.innerHTML = ""; // limpa o conteúdo
      vagas.forEach(renderMySpot); // usa a função reaproveitável
    })
    .catch(err => console.error("Erro ao carregar minhas vagas:", err));
}

document.addEventListener("click", (e) => {
  if (e.target.matches("button[data-action='excluir']")) {
    const vagaId = e.target.getAttribute("data-id");

    if (confirm("Tem certeza que deseja excluir esta vaga?")) {
      excluirVaga(vagaId, e.target);
    }
  }
});

function excluirVaga(vagaId, botao) {
  fetch(`/parking/api/spots/${vagaId}/`, {
    method: "DELETE",
    headers: {
      "X-CSRFToken": csrfToken,
    },
  })
    .then((res) => {
      if (!res.ok) throw new Error("Erro ao excluir a vaga");

      // Remove o card da vaga visualmente
      const card = botao.closest(".border");
      if (card) card.remove();
    })
    .catch((err) => {
      console.error(err);
      alert("Erro ao excluir a vaga.");
    });
}