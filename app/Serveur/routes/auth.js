import { pool } from "./../db/pool.js"
import express from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

const router = express.Router()

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.post("/signup", async (req, res) => {
    const { nom_utilisateur, email, password } = req.body

    if (!nom_utilisateur || !email || !password) {
        return res.status(400).json({ error: "Nom d'utilisateur, email et mot de passe requis" })
    }

    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: "Format d'email invalide" })
    }

    if (password.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères" })
    }

    try {
        const existing = await pool.query(
            "select id from utilisateurs where email = $1 or nom_utilisateur = $2",
            [email, nom_utilisateur]
        )

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: "Email ou nom d'utilisateur déjà utilisé" })
        }

        const mot_de_passe_hash = await bcrypt.hash(password, 10)

        const result = await pool.query(
            "insert into utilisateurs (nom_utilisateur, email, mot_de_passe_hash) values ($1, $2, $3) returning id, nom_utilisateur, email, cree_le",
            [nom_utilisateur, email, mot_de_passe_hash]
        )

        res.status(201).json({ user: result.rows[0] })
    } catch (error) {
        // 23505 = violation de contrainte UNIQUE (ex. race condition entre le check et l'insert)
        if (error.code === "23505") {
            return res.status(409).json({ error: "Email ou nom d'utilisateur déjà utilisé" })
        }
        console.error("Erreur dans /auth/signup", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

router.post("/login", async (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
        return res.status(400).json({ error: "Email et mot de passe requis" })
    }

    try {
        const result = await pool.query(
            "select id, nom_utilisateur, email, mot_de_passe_hash from utilisateurs where email = $1",
            [email]
        )

        const user = result.rows[0]

        // Même message d'erreur peu importe la cause, pour ne pas révéler si l'email existe
        if (!user) {
            return res.status(401).json({ error: "Email ou mot de passe incorrect" })
        }

        const motDePasseValide = await bcrypt.compare(password, user.mot_de_passe_hash)

        if (!motDePasseValide) {
            return res.status(401).json({ error: "Email ou mot de passe incorrect" })
        }

        const token = jwt.sign(
            { id: user.id, nom_utilisateur: user.nom_utilisateur },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        )

        res.status(200).json({
            token,
            user: { id: user.id, nom_utilisateur: user.nom_utilisateur, email: user.email }
        })
    } catch (error) {
        console.error("Erreur dans /auth/login", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

router.post("/check-email", async (req, res) => {
    const { email } = req.body

    if (!email) {
        return res.status(400).json({ error: "Email requis" })
    }

    try {
        const result = await pool.query("select id from utilisateurs where email = $1", [email])
        res.status(200).json({ exists: result.rows.length > 0 })
    } catch (error) {
        console.error("Erreur dans /auth/check-email", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

export default router
