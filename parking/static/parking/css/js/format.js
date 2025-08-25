export function formatarTamanhoVaga(tamanho) {
    if (typeof tamanho === 'string') {
        return tamanho.replace(/\s*\(.*\)/, '').trim();
    }
    return tamanho; 
}

export function formatarTipoVaga(tipo) {
    switch (tipo) {
        case 'rua_coberta': return 'Rua (Coberta)';
        case 'rua_descoberta': return 'Rua (Descoberta)';
        case 'garagem': return 'Garagem';
        case 'predio_coberta': return 'Prédio (Coberta)';
        case 'predio_descoberta': return 'Prédio (Descoberta)';
        default: return tipo; // Retorna o valor original se não for reconhecido
    }
}

export function formatarHorarioDisponivelModal(spot) {
    if (spot.availabilities_by_date && spot.availabilities_by_date.length > 0) {
        const firstAvailability = spot.availabilities_by_date[0];
        const startTime = firstAvailability.start_time ? firstAvailability.start_time.substring(0, 5) : 'N/A';
        const endTime = firstAvailability.end_time ? firstAvailability.end_time.substring(0, 5) : 'N/A';
        return `${startTime} - ${endTime}`;
    }
    return '24h/dia (aprox.)'; 
}

export function formatDateToISO(date) {
    if (!(date instanceof Date)) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}