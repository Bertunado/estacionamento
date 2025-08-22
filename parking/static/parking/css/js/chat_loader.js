// A função de carregamento é exportada no nível superior
export async function loadMessages(convId) {
    try {
        const response = await fetch(`/parking/api/chat/${convId}/messages/`);
        if (!response.ok) {
            throw new Error('Erro ao carregar as mensagens.');
        }
        const messages = await response.json();
        
        const messageBox = document.getElementById('msg-box');
        const currentUserId = JSON.parse(document.getElementById('userIdData').textContent);

        if (!messageBox) {
            console.error('Elemento #msg-box não encontrado.');
            return;
        }

        messageBox.innerHTML = '';
        messages.forEach(msg => {
            const isSender = (msg.sender_id === currentUserId);
            const messageClass = isSender ? 'text-right' : 'text-left';
            const messageHtml = `
                <p class="${messageClass} mb-2">
                    <span class="inline-block p-2 rounded-lg ${isSender ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'}">
                        <strong>${msg.sender_username}:</strong> ${msg.text}
                        <small class="text-xs opacity-75">(${msg.created_at})</small>
                    </span>
                </p>
            `;
            messageBox.insertAdjacentHTML('beforeend', messageHtml);
        });
        messageBox.scrollTop = messageBox.scrollHeight;
    } catch (error) {
        console.error(error);
        const messageBox = document.getElementById('msg-box');
        if (messageBox) {
            messageBox.innerHTML = '<p class="text-center text-red-500">Erro ao carregar as mensagens. Tente novamente.</p>';
        }
    }
}

export function showToast(message, isSuccess) {
    const toast = document.getElementById('toast-notification');
    const toastMessage = document.getElementById('toast-message');

    if (!toast || !toastMessage) {
        console.error('Elementos da toast notification não encontrados.');
        return;
    }

    // Configura a mensagem e a cor
    toastMessage.textContent = message;
    if (isSuccess) {
        toast.classList.remove('bg-red-500');
        toast.classList.add('bg-green-500');
    } else {
        toast.classList.remove('bg-green-500');
        toast.classList.add('bg-red-500');
    }

    // Mostra a toast (remove as classes de escondido e adiciona a de visível)
    toast.classList.remove('translate-y-full', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    // Esconde a toast após 3 segundos
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-full', 'opacity-0');
    }, 3000);
}

// O restante do código é executado somente após o DOM estar carregado
document.addEventListener('DOMContentLoaded', function() {
    const conversationList = document.getElementById('conversation-list');
    const initialMessage = document.getElementById('initial-message');
    const chatContent = document.getElementById('chat-content');
    const messageForm = document.getElementById('msg-form');
    const chatTitle = document.getElementById('chat-title');
    const messageBox = document.getElementById('msg-box');
    const userIdElement = document.getElementById('userIdData');
    const deleteChatBtn = document.getElementById('delete-chat-btn');
    const deleteChatModal = document.getElementById('delete-chat-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    
    
    // ✅ Verificações essenciais primeiro
    if (!conversationList || !messageForm || !userIdElement) {
        console.error('Um ou mais elementos HTML necessários para o chat não foram encontrados.');
        return;
    }

    const currentUserId = JSON.parse(userIdElement.textContent);
    let currentConversationId = null;

    loadConversations();
    // ✅ Listeners de eventos depois que todas as variáveis são definidas

    // Gerencia o clique na lista de conversas
    conversationList.addEventListener('click', function(event) {
        const clickedItem = event.target.closest('li[data-conversation-id]');
        if (!clickedItem) return;

        document.querySelectorAll('li[data-conversation-id]').forEach(item => {
            item.classList.remove('bg-gray-200');
        });
        clickedItem.classList.add('bg-gray-200');

        currentConversationId = clickedItem.dataset.conversationId;
        const conversationTitle = clickedItem.querySelector('.font-bold').textContent.trim();

        initialMessage.classList.add('hidden');
        chatContent.classList.remove('hidden');
        chatTitle.textContent = `Conversa com ${conversationTitle}`;

        loadMessages(currentConversationId);
    });

    // Gerencia o envio do formulário de mensagens
    messageForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        const textInput = messageForm.querySelector('input[name="text"]');
        const messageText = textInput.value.trim();

        if (!messageText || !currentConversationId) {
            return;
        }

        const formData = new FormData();
        formData.append('text', messageText);
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]');
        if (csrfToken) {
            formData.append('csrfmiddlewaretoken', csrfToken.value);
        } else {
            console.error('CSRF token não encontrado.');
            return;
        }

        try {
            const response = await fetch(`/parking/api/chat/${currentConversationId}/send/`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Erro ao enviar a mensagem.');
            }

            const newMessage = await response.json();
            
            const isSender = (currentUserId === newMessage.sender_id);
            const messageClass = isSender ? 'text-right' : 'text-left';
            const messageHtml = `
                <p class="${messageClass} mb-2">
                    <span class="inline-block p-2 rounded-lg ${isSender ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'}">
                        <strong>${newMessage.sender_username}:</strong> ${newMessage.text}
                        <small class="text-xs opacity-75">(${newMessage.created_at})</small>
                    </span>
                </p>
            `;
            messageBox.insertAdjacentHTML('beforeend', messageHtml);
            
            textInput.value = '';
            messageBox.scrollTop = messageBox.scrollHeight;
            
        } catch (error) {
            console.error(error);
            alert('Não foi possível enviar a mensagem.');
        }
    });

    // ✅ Gerencia o clique no botão de exclusão (AGORA DEPOIS DAS VARIÁVEIS)
    if (deleteChatBtn) {
    deleteChatBtn.addEventListener('click', function() {
        if (!currentConversationId) {
            alert('Nenhuma conversa selecionada para exclusão.');
            return;
        }
        // ✅ Mostra o modal de confirmação
        deleteChatModal.classList.remove('hidden');
    });
}

// ✅ Gerencia o clique no botão de CONFIRMAÇÃO do modal
if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async function() {
        try {
            const response = await fetch(`/parking/api/chat/${currentConversationId}/delete/`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao excluir a conversa.');
            }

            // Esconde o modal e atualiza a UI
            deleteChatModal.classList.add('hidden');
            
            // Remove o item da lista e limpa o painel de chat
            const deletedItem = document.querySelector(`li[data-conversation-id="${currentConversationId}"]`);
            if (deletedItem) {
                deletedItem.remove();
            }

            initialMessage.classList.remove('hidden');
            chatContent.classList.add('hidden');
            currentConversationId = null;

            showToast('Conversa excluída com sucesso!', true);

        } catch (error) {
            console.error(error);
            alert('Não foi possível excluir a conversa.');
            deleteChatModal.classList.add('hidden'); // Esconde o modal mesmo em caso de erro
        }
    });
}

// ✅ Gerencia o clique no botão de CANCELAMENTO do modal
if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', function() {
        deleteChatModal.classList.add('hidden');
    });
}

// ✅ Fecha o modal clicando fora dele
if (deleteChatModal) {
    deleteChatModal.addEventListener('click', function(event) {
        if (event.target === this) {
            deleteChatModal.classList.add('hidden');
        }
    });
}
});

export async function loadConversations() {
    const conversationList = document.getElementById('conversation-list');
    if (!conversationList) return;

    try {
        const response = await fetch('/parking/api/conversations/');
        if (!response.ok) {
            throw new Error('Erro ao carregar a lista de conversas.');
        }
        const conversations = await response.json();

        // Limpa a lista existente
        conversationList.innerHTML = '';

        if (conversations.length === 0) {
            conversationList.innerHTML = '<li class="p-4 text-gray-500 text-center">Nenhuma conversa encontrada.</li>';
        } else {
            // Cria os elementos HTML para cada conversa
            conversations.forEach(conv => {
                const li = document.createElement('li');
                li.classList.add('p-4', 'cursor-pointer', 'hover:bg-gray-100', 'transition-colors', 'duration-200');
                li.dataset.conversationId = conv.id;

                const photoUrl = conv.other_user_photo_url;
                
                li.innerHTML = `
                    <a href="#" class="flex items-center space-x-4">
                        <img src="${photoUrl}" class="w-12 h-12 rounded-full object-cover" alt="Foto de perfil">
                        <div>
                            <p class="font-bold">${conv.other_user_name}</p>
                            <p class="text-sm text-gray-500">Vaga: ${conv.title}</p>
                        </div>
                    </a>
                `;
                conversationList.appendChild(li);
            });
        }
    } catch (error) {
        console.error('Falha ao carregar conversas:', error);
        conversationList.innerHTML = '<li class="p-4 text-gray-500 text-center text-red-500">Erro ao carregar conversas.</li>';
    }
}