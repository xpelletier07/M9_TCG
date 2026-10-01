import jwt from "jsonwebtoken"

// Vérifie qu'un token JWT valide est fourni avant de laisser passer la requête
export function checkAuth(req, res, next) {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentification requise" })
    }

    const token = authHeader.split(" ")[1]

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET)
        req.user = payload
        next()
    } catch (error) {
        return res.status(401).json({ error: "Token invalide ou expiré" })
    }
}

// Vérifie si l'utilisateur connecté a accès aux fonctionalités administrateur en regardant son rôle/statut
export function checkAdmin(req, res, next) {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]
    if (!token) {
        return res.status(401).json({ message: "Accès refusé. Token manquant." })
    }
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET)
        req.user = payload
        if (payload.statut != 'admin') {
            return res.status(403).json({ message: "Accès refusé" })
        }
        else {
            next()
        }
    } catch (error) {
        return res.status(401).json({ message: "Token invalide ou expiré" })
    }
}