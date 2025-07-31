import { geocode } from './map_utilities.js';
import {
    createSpot,
    uploadPhotos as apiUploadPhotos,
    saveAvailabilities,
    updateSpot
} from './api_services.js';

import { carregarMinhasVagas, activateTab, carregarSpotsDaListaEdoMapa } from './ui_handlers.js';
import { uploadedFiles } from './globals.js';
import { coletarDisponibilidades } from './availability_manager.js';
import { clearPhotoPreviews } from './photo_upload.js';
import { setupAvailabilityFields } from './availability_manager.js';


const successModal = document.getElementById('success-modal');
const successMessage = document.getElementById('success-message');
const successOkButton = document.getElementById('success-ok-button');

// LISTENER PARA O BOTÃO OK DO MODAL DE SUCESSO
if (successOkButton) {
    successOkButton.addEventListener('click', () => {
        if (successModal) {
            successModal.classList.add('hidden'); // Esconde o modal
        }
        
        // Ativa a aba "Adicionar Vaga"
        // 'add-parking' é o ID da div principal da aba no seu HTML
        activateTab('add-parking'); 
        
        // Recarregar as listas para exibir a nova vaga/atualização.
        carregarMinhasVagas(); 
        carregarSpotsDaListaEdoMapa();
    });
}

// ** FUNÇÃO CONSOLIDADA PARA SUBMISSÃO DE VAGA **
export async function handleSubmitSpot(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  // Coleta de dados usando os atributos 'name' do seu HTML
  const title = formData.get("title")?.trim();
  const address = formData.get("address")?.trim();
  const price_hour = formData.get("price_hour") || "0";
  const price_day = formData.get("price_day") || "0";
  const size = formData.get("size") || "Indefinido";
  const tipo_vaga = formData.get("tipo_vaga");
  const description = formData.get("description")?.trim();
  
  // O seu HTML não mostra um campo 'quantity', então mantenha o padrão 1
  const quantity = formData.get("quantity") || "1"; 

  const disponibilidadesParaSalvar = coletarDisponibilidades(); 


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
    quantity: parseInt(quantity), // Converte para inteiro
  };

  try {
        const spot = await createSpot(payload);

        if (disponibilidadesParaSalvar.length > 0) {
            await saveAvailabilities(spot.id, disponibilidadesParaSalvar); 
            console.log("Disponibilidades salvas com sucesso!");
        } else {
            console.log("Nenhuma disponibilidade para salvar.");
        }

        if (uploadedFiles.length > 0) {
            console.log(`Subindo ${uploadedFiles.length} fotos para a vaga ID: ${spot.id}`);
            await apiUploadPhotos(spot.id, uploadedFiles);
            console.log("Fotos enviadas com sucesso!");
        } else {
            console.log("Nenhuma foto para subir.");
        }

        // Limpeza do formulário e previews AQUI, ANTES de exibir o modal
        form.reset(); 
        clearPhotoPreviews(); 
        uploadedFiles.length = 0;

        if (successMessage) {
            successMessage.textContent = "Vaga publicada com sucesso!";
        }
        if (successModal) {
            successModal.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error("Erro ao salvar vaga ou fazer upload das fotos:", error);
        alert("Erro ao salvar vaga:\n" + (error.message || "Erro desconhecido."));
    }
}

// ** NOVA FUNÇÃO setupNewSpotForm SIMPLIFICADA E CORRIGIDA PARA O ID DO HTML **
export function setupNewSpotForm() {
  const addParkingForm = document.getElementById("addParkingForm"); // <-- CORREÇÃO: Usando 'addParkingForm'
  if (addParkingForm) {
    addParkingForm.addEventListener("submit", handleSubmitSpot);
  }
}

export function setupEditSpotForm(spotToEdit) {
    const editModal = document.getElementById("edit-spot-modal"); 
    const editForm = document.getElementById("editParkingForm");

    if (!editModal || !editForm) {
        console.error("Modal de edição ou formulário de edição não encontrados.");
        return;
    }

    if (spotToEdit) {
        document.getElementById("edit-spot-id").value = spotToEdit.id;
        document.getElementById("edit-title").value = spotToEdit.title;
        document.getElementById("edit-address").value = spotToEdit.address;
        document.getElementById("edit-price_hour").value = spotToEdit.price_hour;
        document.getElementById("edit-price_day").value = spotToEdit.price_day;
        document.getElementById("edit-size").value = spotToEdit.size;
        document.getElementById("edit-tipo_vaga").value = spotToEdit.tipo_vaga;
        document.getElementById("edit-description").value = spotToEdit.description;
        // Se houver campos de quantidade na edição, carregue aqui também
        // document.getElementById("edit-quantity").value = spotToEdit.quantity;
    }

    editModal.classList.remove("hidden");

    editForm.removeEventListener('submit', handleEditSpotSubmit);
    editForm.addEventListener('submit', handleEditSpotSubmit);

    async function handleEditSpotSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);

        const spotId = formData.get("edit-spot-id");
        const title = formData.get("edit-title")?.trim();
        const address = formData.get("edit-address")?.trim();
        const price_hour = formData.get("edit-price_hour") || "0";
        const price_day = formData.get("edit-price_day") || "0";
        const size = formData.get("edit-size") || "Indefinido";
        const tipo_vaga = formData.get("edit-tipo_vaga");
        const description = formData.get("edit-description")?.trim();
        const quantity = formData.get("quantity") || "1"; // Assume 1 se não houver campo ou valor

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
            availabilities: [], // As disponibilidades de edição seriam tratadas separadamente
            quantity: parseInt(quantity),
        };

        try {
            await updateSpot(spotId, payload); 
            
            if (successMessage) {
                successMessage.textContent = "Vaga atualizada com sucesso!";
            }
            if (successModal) {
                successModal.classList.remove('hidden');
            }
            
            editModal.classList.add("hidden"); 
            
            carregarMinhasVagas(); 
            carregarSpotsDaListaEdoMapa();
        } catch (error) {
            console.error("Erro ao atualizar vaga:", error);
            alert("Erro ao atualizar vaga:\n" + (error.message || "Erro desconhecido."));
        }
    }
}