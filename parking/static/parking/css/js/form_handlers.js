// Lógica para manipulação de formulários

import { geocode } from './map_utilities.js';
import {
    createSpot,
    uploadPhotos as apiUploadPhotos,
    saveAvailabilities,
    updateSpot
} from './api_services.js';

import { renderSpot, carregarMinhasVagas, activateTab, carregarSpotsDaListaEdoMapa } from './ui_handlers.js';
import { uploadedFiles } from './globals.js';
import { coletarDisponibilidades } from './availability_manager.js';
import { clearPhotoPreviews } from './photo_upload.js'; // Para limpar o preview após o upload

export async function handleSubmitSpot(e) {
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

  if (!title || !address || !description) {
    alert("Preencha título, endereço e descrição.");
    return;
  }

  const loc = await geocode(address);
  if (!loc) {
    alert("Endereço inválido ou não encontrado.");
    return;
  }

  const latitude = Number(loc.lat.toFixed(6));
  const longitude = Number(loc.lng.toFixed(6));
  const disponibilidade = coletarDisponibilidades(); // Usa a função do módulo de disponibilidade

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

  try {
        const spot = await createSpot(payload); // Cria a vaga sem as fotos

        // --- LÓGICA DE UPLOAD DE FOTOS ---
        if (uploadedFiles.length > 0) {
            console.log(`Subindo ${uploadedFiles.length} fotos para a vaga ID: ${spot.id}`);
            await apiUploadPhotos(spot.id, uploadedFiles); // Chama a função de upload
            console.log("Fotos enviadas com sucesso!");
        } else {
            console.log("Nenhuma foto para subir.");
        }

        alert("Vaga publicada com sucesso!");
        form.reset(); // Limpa o formulário

        clearPhotoPreviews(); 
        uploadedFiles.length = 0; // Zera o array de arquivos

        // Atualiza a UI
        renderSpot(spot); // Renderiza a nova vaga na lista de vagas disponíveis
        carregarMinhasVagas(); // Recarrega a lista de "Minhas Vagas" para incluir a nova vaga
    } catch (error) {
        console.error("Erro ao salvar vaga ou fazer upload das fotos:", error);
        alert("Erro ao salvar vaga:\n" + (error.message || "Erro desconhecido."));
    }
}

// Handler para o formulário de nova vaga (antigo "form-nova-vaga")
export function setupNewSpotForm() {
  const formNovaVaga = document.getElementById("form-nova-vaga");
  if (formNovaVaga) {
    formNovaVaga.addEventListener("submit", async function (e) {
      e.preventDefault();

      const titulo = document.getElementById("titulo").value;
      const descricao = document.getElementById("descricao").value;
      const preco = document.getElementById("preco").value;
      const cep = document.getElementById("cep").value;

      const latInput = document.getElementById("latInput");
      const lngInput = document.getElementById("lngInput"); 
      let latitude = latInput ? latInput.value : null;
      let longitude = lngInput ? lngInput.value : null;
      let imagemBase64 = null;

      if (cep && (!latitude || !longitude)) {
          const loc = await geocode(cep); // Tenta geocodificar o CEP se lat/lng não estiverem definidos
          if (loc) {
              latitude = loc.lat;
              longitude = loc.lng;
          } else {
              alert("CEP inválido ou não encontrado.");
              return;
          }
      }

      const vagaData = {
        title: titulo, 
        description: descricao,
        price_hour: preco, 
        address: cep, 
        latitude: latitude,
        longitude: longitude,
      };

      try {
        const vagaResult = await createSpot(vagaData);
        const spotId = vagaResult.id || vagaResult.spot_id;

        if (!spotId) {
          throw new Error("ID da vaga não retornado");
        }

        const availabilities = coletarDisponibilidades();

        if (availabilities.length > 0) {
          await saveAvailabilities(spotId, availabilities);
        }
        alert("Vaga e disponibilidades cadastradas com sucesso!");
      } catch (error) {
        alert(error.message);
      }
    });
  }
}

export function setupEditSpotForm(spotToEdit) {
    const editModal = document.getElementById("edit-spot-modal");
    const editForm = document.getElementById("editParkingForm");

    if (!editModal || !editForm) {
        console.error("Modal de edição ou formulário de edição não encontrados.");
        return;
    }

    // Preenche o formulário com os dados da vaga a ser editada
    if (spotToEdit) {
        document.getElementById("edit-spot-id").value = spotToEdit.id; // Campo oculto para o ID
        document.getElementById("edit-title").value = spotToEdit.title;
        document.getElementById("edit-address").value = spotToEdit.address;
        document.getElementById("edit-price_hour").value = spotToEdit.price_hour;
        document.getElementById("edit-price_day").value = spotToEdit.price_day;
        document.getElementById("edit-size").value = spotToEdit.size;
        document.getElementById("edit-tipo_vaga").value = spotToEdit.tipo_vaga;
        document.getElementById("edit-description").value = spotToEdit.description;
        
    }

    editModal.classList.remove("hidden"); // Mostra o modal de edição

    // Adiciona o event listener para a submissão do formulário de edição
    // Remova qualquer listener duplicado que possa existir
    editForm.removeEventListener('submit', handleEditSpotSubmit); // Remove o antigo se existir
    editForm.addEventListener('submit', handleEditSpotSubmit); // Adiciona o novo

    async function handleEditSpotSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);

        const spotId = formData.get("edit-spot-id"); // Pega o ID da vaga
        const title = formData.get("edit-title")?.trim();
        const address = formData.get("edit-address")?.trim();
        const price_hour = formData.get("edit-price_hour") || "0";
        const price_day = formData.get("edit-price_day") || "0";
        const size = formData.get("edit-size") || "Indefinido";
        const tipo_vaga = formData.get("edit-tipo_vaga");
        const description = formData.get("edit-description")?.trim();

        if (!spotId || !title || !address || !description) {
            alert("Preencha todos os campos obrigatórios para edição.");
            return;
        }

        const loc = await geocode(address);
        if (!loc) {
            alert("Endereço inválido ou não encontrado para edição.");
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
            tipo_vaga,
            description,
            availabilities: disponibilidade,
        };

        try {
            await updateSpot(spotId, payload);           
            alert("Vaga atualizada com sucesso!");
            editModal.classList.add("hidden"); // Esconde o modal
            carregarMinhasVagas(); // Recarrega a lista de minhas vagas para mostrar as alterações
            carregarSpotsDaListaEdoMapa(); // Recarrega a lista principal e o mapa
        } catch (error) {
            console.error("Erro ao atualizar vaga:", error);
            alert("Erro ao atualizar vaga:\n" + (error.message || "Erro desconhecido."));
        }
    }
}