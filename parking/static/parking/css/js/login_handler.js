// static/parking/js/login_handler.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginErrorMessage = document.getElementById('login-error-message');

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault(); 

            loginErrorMessage.classList.add('hidden'); 

            const usernameInput = document.getElementById('id_username'); 
            const passwordInput = document.getElementById('id_password');

            const username = usernameInput.value;
            const password = passwordInput.value;

            try {
                const response = await fetch('/parking/api/token/login/', { 
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken'), 
                    },
                    body: JSON.stringify({ username: username, password: password })
                });

                if (!response.ok) {
                    let errorDetail = 'Ocorreu um erro no login. Verifique suas credenciais.';
                    try {
                        const errorData = await response.json();
                        errorDetail = errorData.non_field_errors?.[0] || errorData.detail || errorDetail;
                    } catch (e) {
                        console.error("Erro ao analisar resposta de erro (provavelmente HTML de erro 403):", e);
                        // Se não for JSON, use uma mensagem padrão para o 403
                        if (response.status === 403) {
                            errorDetail = 'Acesso negado. Por favor, tente novamente ou entre em contato com o suporte.';
                        }
                    }
                    loginErrorMessage.textContent = errorDetail;
                    loginErrorMessage.classList.remove('hidden');
                } else {
                    const data = await response.json();
                    const authToken = data.token; 

                    localStorage.setItem('authToken', authToken); 
                    console.log("Login bem-sucedido! Token salvo no localStorage.");

                    window.location.href = '/home/'; 
                }
            } catch (error) {
                console.error("Erro na requisição de login:", error);
                // Se o erro for de rede msg genérica 
                if (loginErrorMessage.classList.contains('hidden')) { 
                    loginErrorMessage.textContent = "Erro de conexão com o servidor. Verifique sua internet ou tente mais tarde.";
                    loginErrorMessage.classList.remove('hidden');
                }
            }
        });
    }
});

// Helper para obter o CSRF token de um cookie
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Verifica se o cookie começa com o nome desejado
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}