import express from "express"
import bcrypt from "bcrypt"
import { pool } from "../db/pool.js"
import { checkAuth } from "../middlewares/checkAuth.js"

const router = express.Router()

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_REGEX = /^[a-zA-Z0-9_\-\. ]{3,50}$/

function isValidAvatarUrl(url) {
    if (!url) return true
    if (typeof url !== "string" || url.length > 2048) return false
    const trimmed = url.trim().toLowerCase()
    if (trimmed.startsWith("javascript:") || trimmed.startsWith("data:") || trimmed.startsWith("vbscript:")) {
        return false
    }

    if (/\.gif($|\?|#)/i.test(trimmed)) {
        return false
    }

    try {
        const parsed = new URL(url)
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return false
        }

        const path = parsed.pathname.toLowerCase()
        const search = parsed.search.toLowerCase()

        if (path.endsWith(".gif") || search.includes(".gif") || search.includes("format=gif") || search.includes("fm=gif")) {
            return false
        }

        const hasValidExt = /\.(png|webp|wedp|jpe?g)$/i.test(path)
        const hasValidParam = /(format|fm|ext)=(png|webp|wedp|jpe?g)($|&)/i.test(search)

        return hasValidExt || hasValidParam
    } catch {
        return false
    }
}

// Récupère les informations détaillées du profil connecté
router.get("/profile", checkAuth, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, nom_utilisateur, email, avatar_url, credits, statut, cree_le, github_id FROM utilisateurs WHERE id = $1",
            [req.user.id]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Utilisateur introuvable" })
        }

        res.status(200).json(result.rows[0])
    } catch (error) {
        console.error("Erreur dans GET /settings/profile :", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Met à jour les informations du profil (nom d'utilisateur, email, photo de profil)
router.put("/profile", checkAuth, async (req, res) => {
    const { nom_utilisateur, email, avatar_url } = req.body

    if (nom_utilisateur !== undefined) {
        const trimmed = nom_utilisateur.trim()
        if (trimmed.length < 3) {
            return res.status(400).json({ error: "Le nom d'utilisateur doit comporter au moins 3 caractères" })
        }
        if (trimmed.length > 50 || !USERNAME_REGEX.test(trimmed)) {
            return res.status(400).json({ error: "Le nom d'utilisateur contient des caractères non autorisés ou dépasse 50 caractères" })
        }
    }

    if (email !== undefined && (!EMAIL_REGEX.test(email) || email.length > 255)) {
        return res.status(400).json({ error: "Format d'email invalide" })
    }

    if (avatar_url !== undefined && avatar_url !== null && avatar_url !== "" && !isValidAvatarUrl(avatar_url)) {
        return res.status(400).json({ error: "URL d'avatar non sécurisée ou invalide" })
    }

    try {
        // Vérifie si le nouvel email ou nom d'utilisateur est déjà utilisé par un autre compte
        const conflictCheck = await pool.query(
            "SELECT id FROM utilisateurs WHERE (email = $1 OR nom_utilisateur = $2) AND id != $3",
            [email || null, nom_utilisateur || null, req.user.id]
        )

        if (conflictCheck.rows.length > 0) {
            return res.status(409).json({ error: "Ce nom d'utilisateur ou cet email est déjà utilisé" })
        }

        const result = await pool.query(
            `UPDATE utilisateurs
             SET nom_utilisateur = COALESCE($1, nom_utilisateur),
                 email = COALESCE($2, email),
                 avatar_url = COALESCE($3, avatar_url)
             WHERE id = $4
             RETURNING id, nom_utilisateur, email, avatar_url, credits, statut, cree_le`,
            [nom_utilisateur ? nom_utilisateur.trim() : null, email ? email.trim() : null, avatar_url !== undefined ? avatar_url : null, req.user.id]
        )

        res.status(200).json({
            message: "Profil mis à jour avec succès",
            user: result.rows[0]
        })
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ error: "Ce nom d'utilisateur ou cet email est déjà utilisé" })
        }
        console.error("Erreur dans PUT /settings/profile :", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Met à jour le mot de passe du compte
router.put("/password", checkAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body

    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères" })
    }

    if (newPassword.length > 128) {
        return res.status(400).json({ error: "Le mot de passe ne doit pas dépasser 128 caractères" })
    }

    try {
        const userResult = await pool.query(
            "SELECT id, mot_de_passe_hash, github_id FROM utilisateurs WHERE id = $1",
            [req.user.id]
        )

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "Utilisateur introuvable" })
        }

        const user = userResult.rows[0]

        // Si l'utilisateur possède déjà un mot de passe local, on vérifie l'ancien
        if (user.mot_de_passe_hash) {
            if (!currentPassword) {
                return res.status(400).json({ error: "Le mot de passe actuel est requis" })
            }

            const valid = await bcrypt.compare(currentPassword, user.mot_de_passe_hash)
            if (!valid) {
                return res.status(401).json({ error: "Mot de passe actuel incorrect" })
            }
        }

        const mot_de_passe_hash = await bcrypt.hash(newPassword, 10)

        await pool.query(
            "UPDATE utilisateurs SET mot_de_passe_hash = $1 WHERE id = $2",
            [mot_de_passe_hash, req.user.id]
        )

        res.status(200).json({ message: "Mot de passe mis à jour avec succès" })
    } catch (error) {
        console.error("Erreur dans PUT /settings/password :", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Met à jour la photo de profil / avatar
router.put("/avatar", checkAuth, async (req, res) => {
    const { avatar_url } = req.body

    if (avatar_url !== undefined && avatar_url !== null && avatar_url !== "" && !isValidAvatarUrl(avatar_url)) {
        return res.status(400).json({ error: "URL d'avatar non sécurisée ou invalide" })
    }

    try {
        const result = await pool.query(
            "UPDATE utilisateurs SET avatar_url = $1 WHERE id = $2 RETURNING id, nom_utilisateur, email, avatar_url",
            [avatar_url || null, req.user.id]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Utilisateur introuvable" })
        }

        res.status(200).json({
            message: "Photo de profil mise à jour avec succès",
            user: result.rows[0]
        })
    } catch (error) {
        console.error("Erreur dans PUT /settings/avatar :", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

export default router
