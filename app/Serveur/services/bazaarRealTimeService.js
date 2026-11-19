let ioInstance = null

// initialisation de l'instance io
export function setBazaarIo(io) {
    ioInstance = io
}

// broadcaster les updates du Bazaar à tous les joueurs sur la page
export function broadcastBazaarUpdate(idCarte) {
    ioInstance?.emit("bazaar:updated", {
        id_carte: idCarte,
        timestamp: Date.now()
    })
}
