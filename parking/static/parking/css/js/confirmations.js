export function showConfirmModal(message, callback) {
    const modal = document.getElementById('custom-confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const proceedBtn = document.getElementById('proceed-confirm-btn');
    const cancelBtn = document.getElementById('cancel-confirm-btn');

    confirmMessage.textContent = message;
    modal.classList.remove('hidden');

    const handleProceed = () => {
        modal.classList.add('hidden');
        callback();
        proceedBtn.removeEventListener('click', handleProceed);
        cancelBtn.removeEventListener('click', handleCancel);
    };

    const handleCancel = () => {
        modal.classList.add('hidden');
        proceedBtn.removeEventListener('click', handleProceed);
        cancelBtn.removeEventListener('click', handleCancel);
    };

    proceedBtn.addEventListener('click', handleProceed);
    cancelBtn.addEventListener('click', handleCancel);
}