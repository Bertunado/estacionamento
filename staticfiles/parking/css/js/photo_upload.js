// Lógica para a funcionalidade de upload e preview de fotos.

import { uploadedFiles } from './globals.js'; 
import { uploadPhotos as apiUploadPhotos } from './api_services.js';


export function setupPhotoUpload() {
  const dropzone = document.getElementById("photoDropzone");
  const photosInput = document.getElementById("photosInput");
  const previewContainer = document.getElementById("previewContainer");


  if (!dropzone || !photosInput || !previewContainer) {
      console.error("Um ou mais elementos do upload de fotos não foram encontrados.");
      return;
  }

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
    handleFiles(files, previewContainer);
  });

  photosInput.addEventListener("change", (e) => {
    handleFiles(e.target.files, previewContainer);
  });
}

export function handleFiles(files, currentPreviewContainer) {
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;

    uploadedFiles.push(file);

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
        const index = [...currentPreviewContainer.children].indexOf(wrapper);
        if (index > -1) { // Garante que o elemento ainda existe
            uploadedFiles.splice(index, 1);
            wrapper.remove();
        }
      };

      wrapper.appendChild(img);
      wrapper.appendChild(removeBtn);
      currentPreviewContainer.appendChild(wrapper);
    };
    reader.readAsDataURL(file);
  }
}

export function clearPhotoPreviews() {
    const previewContainer = document.getElementById("previewContainer");
    if (previewContainer) {
        previewContainer.innerHTML = ''; // Limpa o HTML do container de pré-visualizações
    }
  }