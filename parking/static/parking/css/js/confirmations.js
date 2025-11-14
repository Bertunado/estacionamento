export function showConfirmationModal(message, confirmText, callback, styleType = 'primary') {
        const modal = document.getElementById('custom-confirm-modal');
        const confirmMessage = document.getElementById('confirm-message');
        const proceedBtn = document.getElementById('proceed-confirm-btn');
        const cancelBtn = document.getElementById('cancel-confirm-btn');
    
        if (!modal || !confirmMessage || !proceedBtn || !cancelBtn) {
            console.error("Elementos do modal de confirmação não encontrados.");
            return;
        }
    
        // 1. Define a mensagem E o texto do botão
        confirmMessage.textContent = message;
        proceedBtn.textContent = confirmText;
    
        // --- 🚀 LÓGICA DAS CORES (NOVA) ---
        // 2. Remove classes de cor antigas
        proceedBtn.classList.remove(
            'bg-red-600', 'hover:bg-red-700',     // Estilo 'danger'
            'bg-indigo-600', 'hover:bg-indigo-700' // Estilo 'primary' (o azul do site)
        );
    
        // 3. Adiciona a classe de cor correta
        if (styleType === 'danger') {
            proceedBtn.classList.add('bg-red-600', 'hover:bg-red-700');
        } else {
            // Por padrão, usa o azul (indigo)
            proceedBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
        }
        // --- FIM DA LÓGICA DAS CORES ---
    
        // 4. Remove listeners antigos para evitar cliques duplicados
        const newProceedBtn = proceedBtn.cloneNode(true);
        proceedBtn.parentNode.replaceChild(newProceedBtn, proceedBtn);
        
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
        // 5. Define as novas ações
        const handleProceed = () => {
            modal.classList.add('hidden');
            callback(); // Roda a ação
        };
    
        const handleCancel = () => {
            modal.classList.add('hidden');
        };
    
        newProceedBtn.addEventListener('click', handleProceed);
        newCancelBtn.addEventListener('click', handleCancel);
    
        // 6. Mostra o modal
        modal.classList.remove('hidden');
    }