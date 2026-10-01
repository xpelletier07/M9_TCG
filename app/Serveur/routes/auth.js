import { pool } from "./../db/pool.js"
import express from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { checkAuth } from "../middlewares/checkAuth.js"

const router = express.Router()

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Crée un nouveau compte utilisateur (inscription)
router.post("/signup", async (req, res) => {
    const { nom_utilisateur, email, password } = req.body

    // Validation de base des champs requis avant de toucher à la base de données
    if (!nom_utilisateur || !email || !password) {
        return res.status(400).json({ error: "Nom d'utilisateur, email et mot de passe requis" })
    }

    // Rejette les formats d'email invalides avant toute requête SQL
    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: "Format d'email invalide" })
    }

    // Longueur minimale imposée au mot de passe (doit matcher la validation faite côté client)
    if (password.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères" })
    }

    try {
        // Vérifie à l'avance si l'email ou le nom d'utilisateur existe déjà, pour renvoyer un message clair
        const existing = await pool.query(
            "select id from utilisateurs where email = $1 or nom_utilisateur = $2",
            [email, nom_utilisateur]
        )

        // Déjà pris -> on arrête ici, pas besoin d'aller plus loin
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: "Email ou nom d'utilisateur déjà utilisé" })
        }

        // Le mot de passe en clair n'est jamais stocké : seul le hash bcrypt (salé, 10 rounds) l'est
        const mot_de_passe_hash = await bcrypt.hash(password, 10)

        // `returning` renvoie la ligne insérée sans jamais inclure le hash du mot de passe
        const result = await pool.query(
            "insert into utilisateurs (nom_utilisateur, email, mot_de_passe_hash) values ($1, $2, $3) returning id, nom_utilisateur, email, cree_le",
            [nom_utilisateur, email, mot_de_passe_hash]
        )

        // 201 Created : le compte vient d'être créé, on renvoie ses infos publiques
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

// Authentifie un utilisateur existant (connexion) et lui délivre un JWT
router.post("/login", async (req, res) => {
    const { email, password } = req.body

    // Les deux champs sont obligatoires pour tenter une authentification
    if (!email || !password) {
        return res.status(400).json({ error: "Email et mot de passe requis" })
    }

    try {
        // Récupère le hash stocké + statut (rôle) pour pouvoir comparer le mot de passe et signer le token
        const result = await pool.query(
            "select id, nom_utilisateur, email, mot_de_passe_hash, statut from utilisateurs where email = $1",
            [email]
        )

        const user = result.rows[0]

        // Même message d'erreur peu importe la cause, pour ne pas révéler si l'email existe
        if (!user) {
            return res.status(401).json({ error: "Email ou mot de passe incorrect" })
        }

        // Compare le mot de passe fourni avec le hash stocké (bcrypt recalcule le même sel)
        const motDePasseValide = await bcrypt.compare(password, user.mot_de_passe_hash)

        if (!motDePasseValide) {
            return res.status(401).json({ error: "Email ou mot de passe incorrect" })
        }

        // Le token contient id/nom/statut et expire après 2h ; il sera renvoyé dans le header
        // Authorization: Bearer <token> sur les requêtes protégées (voir checkAuth.js)
        const token = jwt.sign(
            { id: user.id, nom_utilisateur: user.nom_utilisateur, statut: user.statut },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        )

        // Renvoie le token + les infos publiques du user (jamais le hash du mot de passe)
        res.status(200).json({
            token,
            user: { id: user.id, nom_utilisateur: user.nom_utilisateur, email: user.email }
        })
    } catch (error) {
        console.error("Erreur dans /auth/login", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Permet au frontend de vérifier en direct (onBlur) si un email est déjà pris, avant la soumission du formulaire
router.post("/check-email", async (req, res) => {
    const { email } = req.body

    if (!email) {
        return res.status(400).json({ error: "Email requis" })
    }

    try {
        // Ne renvoie qu'un booléen : jamais les infos du compte trouvé
        const result = await pool.query("select id from utilisateurs where email = $1", [email])
        res.status(200).json({ exists: result.rows.length > 0 })
    } catch (error) {
        console.error("Erreur dans /auth/check-email", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// route pour afficher les infos de l'utilisateur connecté, utilisé pour obtenir le solde et autres.
// checkAuth bloque la requête avant même d'arriver ici si le token est absent/invalide
router.get("/whoAmI", checkAuth, async (req, res) => {
    try {
        // req.user.id vient du payload décodé par checkAuth (voir middlewares/checkAuth.js)
        const result = await pool.query("select * from utilisateurs where id = $1", [req.user.id])
        res.status(200).json(result.rows[0])
    } catch (error) {
        console.error("Erreur dans /auth/whoAmI", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// A SUPPRIMER LORSQU'ON VA AVOIR UNE SEUL BD QUI ROULE TOUT LE TEMPS
// route temporaire pour rendre les utilisateurs de tests admin
router.put("/makeMeAdmin", checkAuth, async (req, res) => {
    try {
        const rows = await pool.query("update utilisateurs set statut = $1 where id = $2", ["admin", req.user.id])
        res.status(204).send()
    } catch (error) {
        console.error("Erreur dans /auth/whoAmI", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

export default router
