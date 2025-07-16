let map;
let uploadedFiles = [];

const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
if (!csrfToken) {
  console.error('CSRF token não encontrado no HTML. Verifique se a meta tag está presente.');
}

// --------------- INICIALIZAÇÃO DO MAPA E AUTOCOMPLETE --------------------
window.initMap = () => {
  if (!window.google) {
    console.error("Google Maps API não carregou ainda.");
    return;
  }

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
  const list = document.querySelector("#parkings .overflow-y-auto");
  if (list) list.innerHTML = ""; // limpa antes de adicionar

  fetch("/parking/api/spots/")
    .then(r => r.json())
    .then(data => {
      const spots = data.results || data;
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
  const tipo_vaga = formData.get("tipo_vaga");
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
  const disponibilidade = [];

  diasDisponibilidade.querySelectorAll(".flex").forEach((div) => {
  const checkbox = div.querySelector("input[type='checkbox']");
  if (checkbox.checked) {
    const dia = checkbox.dataset.dia;
    const hora_inicio = div.querySelector(".hora-inicio").value;
    const hora_fim = div.querySelector(".hora-fim").value;

    if (hora_inicio && hora_fim) {
      disponibilidade.push({
        dia,
        hora_inicio,
        hora_fim,
        quantidade: Number(quantidade),
      });
    }
  }
});

  const payload = {
    title,
    address,
    latitude,
    longitude,
    price_hour,
    price_day,
    size,
    tipo_vaga,
    description,
    disponibilidade,
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
  const files = photosInput.files;
if (files.length > 0) {
  await uploadPhotos(spot.id, files);
  uploadedFiles = [];
  previewContainer.innerHTML = "";
     }
  alert("Vaga publicada com sucesso!");
  form.reset();
  previewContainer.innerHTML = "";
  renderSpot(spot);
  carregarMinhasVagas();
  
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
  if (!spot || !spot.id) {
    console.warn("Spot inválido:", spot);
    return;
  }

  // Adiciona marcador ao mapa
  if (window.map) {
    const marker = new google.maps.Marker({
      map,
      position: { lat: Number(spot.latitude), lng: Number(spot.longitude) },
      title: spot.title,
      icon: {
        url: "/static/parking/css/images/marcador.png",
        scaledSize: new google.maps.Size(55, 55)
      }
    });
    marker._spotId = spot.id;
    if (!window.spotMarkers) window.spotMarkers = {};
    window.spotMarkers[spot.id] = marker;
  }

  // Renderiza card da vaga
  const list = document.querySelector("#parkings .overflow-y-auto");
  if (!list) return;

  const card = document.createElement("div");
  card.className = "border border-gray-200 rounded-lg p-3 hover:bg-gray-50 mb-2";
  card.setAttribute("data-spot-id", spot.id);
  card.innerHTML = `
    <div class="flex justify-between">
      <h4 class="font-medium">${spot.title}</h4>
      <span class="text-sm text-gray-500">${formatarTipoVaga(spot.tipo_vaga)}</span>
    </div>
    <p class="text-sm text-gray-600 mt-1">${spot.address}</p>
    <p class="text-sm text-gray-600 mt-1">R$ ${spot.price_hour}/h | R$ ${spot.price_day}/dia</p>
    <div class="mt-2">
      <img
        src="${spot.photos && spot.photos.length > 0 ? spot.photos[0].image : 'https://placehold.co/600x300'}"
        alt="${spot.description || spot.title}"
        class="w-full h-32 object-cover rounded"
      />
    </div>
  `;
  list.prepend(card);
}

function formatarTipoVaga(tipo) {
  const tipos = {
    rua_coberta: "Rua (Coberta)",
    rua_descoberta: "Rua (Descoberta)",
    garagem: "Garagem",
    predio_coberta: "Prédio (Coberta)",
    predio_descoberta: "Prédio (Descoberta)",
  };
  return tipos[tipo] || "Tipo desconhecido";
}

const diasSemana = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo"
];

const diasDisponibilidade = document.getElementById("diasDisponibilidade");

diasSemana.forEach((dia, index) => {
  const div = document.createElement("div");
  div.className = "flex items-center";

  div.innerHTML = `
    <input type="checkbox" id="dia-${index}" class="mr-2" data-dia="${dia}">
    <label for="dia-${index}" class="w-32">${dia}</label>
    <input type="time" class="ml-2 border border-gray-300 rounded p-1 hora-inicio" disabled>
    <span class="mx-1">às</span>
    <input type="time" class="border border-gray-300 rounded p-1 hora-fim" disabled>
    <input type="number" class="ml-4 border border-gray-300 rounded p-1 qtd-vagas w-20" placeholder="Qtde" min="1">
  `;

  diasDisponibilidade.appendChild(div);
});

// Habilita/desabilita os campos de horário
diasDisponibilidade.addEventListener("change", (e) => {
  if (e.target.matches("input[type='checkbox']")) {
    const container = e.target.closest(".flex");
    container.querySelector(".hora-inicio").disabled = !e.target.checked;
    container.querySelector(".hora-fim").disabled = !e.target.checked;
    const quantidade = div.querySelector(".qtd-vagas")?.value || 0;
  }
});

// --------------- TROCA DE ABAS ------------------------------------------
function switchTab(btn) {
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("border-indigo-600", b === btn);
    b.classList.toggle("text-indigo-600", b === btn);
    b.classList.toggle("text-gray-500", b !== btn);
  });

  document.querySelectorAll(".tab-content").forEach((c) => {
    c.classList.toggle("active", c.id === btn.dataset.tab);
  });

  if (btn.dataset.tab === "my-parkings") {
    carregarMinhasVagas();
  }

  if (btn.dataset.tab === "parkings") {
    carregarSpots(); // ✅ Só carrega as vagas próximas quando necessário
  }

  if (btn.dataset.tab === "add-parking" && !window.autocompleteInicializado) {
    setTimeout(() => {
      initializeAutocomplete();
      window.autocompleteInicializado = true;
    }, 100);
  }
}

function renderMySpot(spot) {
  const container = document.getElementById("myVagasContainer");
  if (!container) return;

  const desativada = spot.status === "Desativada";
  const card = document.createElement("div");

  card.className = `
    border rounded-lg p-4 mb-2 transition
    ${desativada ? "bg-gray-100 text-gray-500 border-gray-300" : "bg-white text-gray-800 border-gray-200"}
  `;
  card.setAttribute("data-spot-id", spot.id);

  card.innerHTML = `
    <div class="flex justify-between items-center">
      <div>
        <h3 class="font-semibold text-lg">${spot.title}</h3>
        <p class="text-sm">${spot.address}</p>
        <p class="text-sm mt-1">R$ ${spot.price_hour}/h ou R$ ${spot.price_day}/dia</p>
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
        <button class="bg-indigo-600 text-white px-3 py-1 text-sm rounded hover:bg-indigo-700" data-id="${spot.id}" data-action="editar">
          Editar
        </button>
        <button class="bg-gray-100 text-gray-800 px-3 py-1 text-sm rounded hover:bg-gray-200">
          Ver Estatísticas
        </button>
        <button class="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700" data-id="${spot.id}" data-action="${desativada ? "ativar" : "desativar"}">
          ${desativada ? "Ativar" : "Desativar"}
        </button>
        <button class="bg-red-100 text-red-600 px-3 py-1 text-sm rounded hover:bg-red-200" data-id="${spot.id}" data-action="excluir">
          Excluir
        </button>
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

function excluirVaga(vagaId, botao) {
  fetch(`/parking/api/spots/${vagaId}/`, {
    method: "DELETE",
    headers: {
      "X-CSRFToken": csrfToken,
    },
  })
  .then((res) => {
    if (!res.ok) throw new Error("Erro ao excluir a vaga");

    // Remove o card da aba "Minhas Vagas"
    const card = botao.closest(".border");
    if (card) card.remove();

    // Remove o card da aba "Vagas Próximas"
    const cardProxima = document.querySelector(`[data-spot-id="${vagaId}"]`);
    if (cardProxima) cardProxima.remove();

    // Remove marcador do mapa
    if (window.spotMarkers && window.spotMarkers[vagaId]) {
      window.spotMarkers[vagaId].setMap(null);
      delete window.spotMarkers[vagaId];
    }

    // Exibe modal de sucesso
    document.getElementById("delete-success-modal").classList.remove("hidden");
  })
  .catch((err) => {
    console.error(err);
    alert("Erro ao excluir a vaga.");
  });
}

let vagaParaDesativar = null;
let idParaExcluir = null;

document.addEventListener("click", (e) => {
  const target = e.target;

  // -------- Botão Desativar --------
  if (target.matches("button[data-action='desativar']")) {
    vagaParaDesativar = target.getAttribute("data-id");
    document.getElementById("deactivate-confirm-modal").classList.remove("hidden");
  }

  // -------- Confirmar Desativação --------
  if (target.id === "confirm-deactivate" && vagaParaDesativar) {
    fetch(`/parking/api/spots/${vagaParaDesativar}/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify({ status: "Desativada" }),
    })
    .then(res => {
      if (!res.ok) throw new Error("Erro ao desativar vaga.");
      return res.json();
    })
    .then(() => {
      if (window.spotMarkers && window.spotMarkers[vagaParaDesativar]) {
        window.spotMarkers[vagaParaDesativar].setMap(null);
        delete window.spotMarkers[vagaParaDesativar];
      }

      carregarMinhasVagas();
      carregarSpots();
      document.getElementById("deactivate-confirm-modal").classList.add("hidden");
      vagaParaDesativar = null;
    })
    .catch(err => {
      console.error("Erro ao desativar:", err);
      alert("Erro ao desativar vaga.");
    });
  }

  // -------- Cancelar Desativação --------
  if (target.id === "cancel-deactivate") {
    document.getElementById("deactivate-confirm-modal").classList.add("hidden");
    vagaParaDesativar = null;
  }

  // -------- Botão Ativar --------
  if (target.matches("button[data-action='ativar']")) {
    const id = target.getAttribute("data-id");
    fetch(`/parking/api/spots/${id}/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify({ status: "Ativa" }),
    })
    .then(res => res.json())
    .then(() => {
      carregarMinhasVagas();
      carregarSpots();
    })
    .catch(err => {
      console.error("Erro ao ativar vaga:", err);
      alert("Erro ao ativar a vaga.");
    });
  }

  // -------- Botão Excluir --------
  if (target.matches("button[data-action='excluir']")) {
    idParaExcluir = target.getAttribute("data-id");
    document.getElementById("delete-confirm-modal").classList.remove("hidden");
  }

  if (target.id === "confirm-delete" && idParaExcluir) {
    const botao = document.querySelector(`button[data-id='${idParaExcluir}'][data-action='excluir']`);
    excluirVaga(idParaExcluir, botao);
    document.getElementById("delete-confirm-modal").classList.add("hidden");
    idParaExcluir = null;
  }

  if (target.id === "cancel-delete") {
    document.getElementById("delete-confirm-modal").classList.add("hidden");
    idParaExcluir = null;
  }

  if (target.id === "success-ok") {
    document.getElementById("delete-success-modal").classList.add("hidden");
  }

  // -------- Botão Editar --------
 const editarBtn = target.closest("button[data-action='editar']") || (target.matches("button[data-action='editar']") ? target : null);
if (editarBtn) {
  const spotId = editarBtn.getAttribute("data-id");
  console.log("Botão editar clicado para o ID:", spotId);

  fetch(`/parking/api/spots/${spotId}/`)
    .then(res => res.json())
    .then(data => {
      document.getElementById("edit-spot-id").value = data.id;
      document.getElementById("edit-title").value = data.title;
      document.getElementById("edit-description").value = data.description;
      document.getElementById("edit-price-hour").value = data.price_hour;
      document.getElementById("edit-price-day").value = data.price_day;

      document.getElementById("edit-spot-modal").classList.remove("hidden");
    })
    .catch(err => {
      console.error("Erro ao carregar vaga para edição:", err);
      alert("Erro ao carregar os dados da vaga.");
    });
}


});

document.getElementById("cancel-edit").addEventListener("click", () => {
  document.getElementById("edit-spot-modal").classList.add("hidden");
});

document.getElementById("edit-spot-form").addEventListener("submit", function (e) {
  e.preventDefault();

  const spotId = document.getElementById("edit-spot-id").value;

  const payload = {
    title: document.getElementById("edit-title").value,
    description: document.getElementById("edit-description").value,
    price_hour: document.getElementById("edit-price-hour").value,
    price_day: document.getElementById("edit-price-day").value
  };

  fetch(`/parking/api/spots/${spotId}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(payload)
  })
  .then(res => {
    if (!res.ok) throw new Error("Erro ao salvar alterações.");
    return res.json();
  })
  .then(() => {
    document.getElementById("edit-spot-modal").classList.add("hidden");
    carregarMinhasVagas();
    carregarSpots();
  })
  .catch(err => {
    console.error(err);
    alert("Erro ao salvar alterações.");
  });
});

const dropzone = document.getElementById("photoDropzone");
const photosInput = document.getElementById("photosInput");
const previewContainer = document.getElementById("previewContainer");

dropzone.addEventListener("click", () => photosInput.click());

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("border-blue-400", "bg-blue-50");
});

dropzone.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dropzone.classList.remove("border-blue-400", "bg-blue-50");
});

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("border-blue-400", "bg-blue-50");
  const files = e.dataTransfer.files;
  handleFiles(files);
});

photosInput.addEventListener("change", (e) => {
  handleFiles(e.target.files);
});

function handleFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;

    uploadedFiles.push(file); // adiciona ao array

    const reader = new FileReader();
    reader.onload = (event) => {
      const wrapper = document.createElement("div");
      wrapper.className = "relative inline-block";

      const img = document.createElement("img");
      img.src = event.target.result;
      img.className = "w-20 h-20 object-cover rounded border";

      const removeBtn = document.createElement("button");
      removeBtn.innerHTML = "×";
      removeBtn.className = `
        absolute top-0 right-0 bg-red-600 text-white w-5 h-5 rounded-full text-xs
        flex items-center justify-center hover:bg-red-700 cursor-pointer
      `;
      removeBtn.onclick = () => {
        const index = [...previewContainer.children].indexOf(wrapper);
        uploadedFiles.splice(index, 1); // remove do array
        wrapper.remove(); // remove do DOM
      };

      wrapper.appendChild(img);
      wrapper.appendChild(removeBtn);
      previewContainer.appendChild(wrapper);
    };
    reader.readAsDataURL(file);
  }
}

async function uploadPhotos(spotId) {
  if (!uploadedFiles.length) return;

  const formData = new FormData();
  formData.append("spot", spotId);
  for (const file of uploadedFiles) {
    formData.append("image", file);
  }

  const resp = await fetch("/parking/api/photos/", {
    method: "POST",
    headers: {
      "X-CSRFToken": csrfToken,
    },
    body: formData,
  });

  if (!resp.ok) {
    alert("Erro ao enviar fotos.");
    return;
  }

  const data = await resp.json();
  console.log("Fotos enviadas", data);
}

