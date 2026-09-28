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
