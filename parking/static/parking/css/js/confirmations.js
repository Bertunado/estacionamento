export function showConfirmationModal(message, confirmText, callback) {
    const modal = document.getElementById('custom-confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const proceedBtn = document.getElementById('proceed-confirm-btn');
    const cancelBtn = document.getElementById('cancel-confirm-btn');

    if (!modal || !confirmMessage || !proceedBtn || !cancelBtn) {
        console.error("Elementos do modal de confirmação não encontrados.");
        return;
    }

    // 2. Define a mensagem E o texto do botão
    confirmMessage.textContent = message;
    proceedBtn.textContent = confirmText; // <-- ESTA É A CORREÇÃO

    // 3. Remove listeners antigos para evitar cliques duplicados
    const newProceedBtn = proceedBtn.cloneNode(true);
    proceedBtn.parentNode.replaceChild(newProceedBtn, proceedBtn);
    
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    // 4. Define as novas ações
    const handleProceed = () => {
        modal.classList.add('hidden');
        callback(); // Roda a ação (ex: handleReservationAction)
    };

    const handleCancel = () => {
        modal.classList.add('hidden');
    };

    newProceedBtn.addEventListener('click', handleProceed);
    newCancelBtn.addEventListener('click', handleCancel);

    // 5. Mostra o modal
    modal.classList.remove('hidden');
}