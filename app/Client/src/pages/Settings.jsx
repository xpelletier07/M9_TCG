import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { API_BASE_URL } from "../config.js";
import "../css/Settings.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_\-\. ]{3,50}$/;

function isSafeUrl(url) {
  if (!url) return true;
  if (typeof url !== "string") return false;
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith("javascript:") || trimmed.startsWith("data:") || trimmed.startsWith("vbscript:")) {
    return false;
  }
  if (/\.gif($|\?|#)/i.test(trimmed)) {
    return false;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const path = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();
    if (path.endsWith(".gif") || search.includes(".gif") || search.includes("format=gif") || search.includes("fm=gif")) {
      return false;
    }
    const hasValidExt = /\.(png|webp|wedp|jpe?g)$/i.test(path);
    const hasValidParam = /(format|fm|ext)=(png|webp|wedp|jpe?g)($|&)/i.test(search);
    return hasValidExt || hasValidParam;
  } catch {
    return false;
  }
}

function Settings() {
  const { user: authUser, token, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  // Clé de stockage pour les avatars récents de cet utilisateur
  const recentStorageKey = `tcg_recent_avatars_${authUser?.id || authUser?.nom_utilisateur || "me"}`;

  // Données complètes de l'utilisateur
  const [profile, setProfile] = useState({
    nom_utilisateur: authUser?.nom_utilisateur || "",
    email: authUser?.email || "",
    avatar_url: authUser?.avatar_url || authUser?.avatar || "",
    credits: authUser?.credits ?? 0,
    statut: authUser?.statut || "actif",
    cree_le: authUser?.cree_le || null,
    github_id: authUser?.github_id || null,
  });

  // États pour les formulaires
  const [usernameInput, setUsernameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [customAvatarUrl, setCustomAvatarUrl] = useState("");
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState("");

  // Historique des avatars récents de l'utilisateur
  const [recentAvatars, setRecentAvatars] = useState(() => {
    try {
      const stored = localStorage.getItem(recentStorageKey);
      return stored ? JSON.parse(stored).filter(isSafeUrl) : [];
    } catch {
      return [];
    }
  });

  // Fonction pour ajouter un avatar à l'historique récent (sans doublon, max 8)
  function addToRecentAvatars(url) {
    if (!url || typeof url !== "string" || !url.trim() || !isSafeUrl(url)) return;
    const cleanUrl = url.trim();
    setRecentAvatars((prev) => {
      const filtered = prev.filter((item) => item !== cleanUrl);
      const updated = [cleanUrl, ...filtered].slice(0, 8);
      try {
        localStorage.setItem(recentStorageKey, JSON.stringify(updated));
      } catch (err) {
        console.error("Erreur sauvegarde avatars récents :", err);
      }
      return updated;
    });
  }

  // États mot de passe
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // État du thème sombre/clair
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    return localStorage.getItem("tcg-theme") === "dark" || document.documentElement.classList.contains("tcg-dark");
  });

  // États de chargement et retours visuels
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: string }
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Synchronisation initiale et récupération des infos fraîches du serveur
  useEffect(() => {
    let isMounted = true;

    async function fetchFreshProfile() {
      if (!token) return;
      try {
        setLoadingProfile(true);
        // Tente la route dédiée /settings/profile puis repli sur /auth/whoAmI
        let res = await fetch(`${API_BASE_URL}/settings/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          res = await fetch(`${API_BASE_URL}/auth/whoAmI`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }

        if (res.ok && isMounted) {
          const data = await res.json();
          setProfile((prev) => ({ ...prev, ...data }));
          setUsernameInput(data.nom_utilisateur || "");
          setEmailInput(data.email || "");
          setSelectedAvatarUrl(data.avatar_url || "");
          if (data.avatar_url) {
            addToRecentAvatars(data.avatar_url);
          }
        }
      } catch (err) {
        console.error("Erreur chargement profil :", err);
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    }

    if (authUser) {
      setUsernameInput(authUser.nom_utilisateur || "");
      setEmailInput(authUser.email || "");
      const currentAv = authUser.avatar_url || authUser.avatar || "";
      setSelectedAvatarUrl(currentAv);
      if (currentAv) {
        addToRecentAvatars(currentAv);
      }
    }

    fetchFreshProfile();

    return () => {
      isMounted = false;
    };
  }, [token, authUser]);

  // Synchronisation du thème avec <html> et événement custom pour la Sidebar
  useEffect(() => {
    document.documentElement.classList.toggle("tcg-dark", isDarkTheme);
    document.documentElement.setAttribute("data-theme", isDarkTheme ? "dark" : "light");
    localStorage.setItem("tcg-theme", isDarkTheme ? "dark" : "light");
    window.dispatchEvent(new CustomEvent("tcg-theme-change", { detail: isDarkTheme }));
  }, [isDarkTheme]);

  // Écoute si le thème est changé depuis la Sidebar
  useEffect(() => {
    function handleExternalThemeChange(e) {
      if (e?.detail !== undefined) {
        setIsDarkTheme(Boolean(e.detail));
      }
    }
    window.addEventListener("tcg-theme-change", handleExternalThemeChange);
    return () => window.removeEventListener("tcg-theme-change", handleExternalThemeChange);
  }, []);

  // Déclenche une notification temporaire
  function notify(type, message) {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  }

  // ── Sauvegarde des informations personnelles (Nom utilisateur, Email) ──
  async function handleSaveProfileInfo(e) {
    e.preventDefault();

    const cleanUsername = usernameInput.trim();
    const cleanEmail = emailInput.trim();

    if (!cleanUsername || cleanUsername.length < 3) {
      notify("error", "Le nom d'utilisateur doit contenir au moins 3 caractères.");
      return;
    }

    if (cleanUsername.length > 50 || !USERNAME_REGEX.test(cleanUsername)) {
      notify("error", "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, espaces, tirets et points (max 50 caractères).");
      return;
    }

    if (!EMAIL_REGEX.test(cleanEmail) || cleanEmail.length > 255) {
      notify("error", "Veuillez fournir une adresse courriel valide.");
      return;
    }

    try {
      setSavingInfo(true);
      const res = await fetch(`${API_BASE_URL}/settings/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nom_utilisateur: cleanUsername,
          email: cleanEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Impossible de mettre à jour le profil.");
      }

      const updatedUser = data.user || {
        ...profile,
        nom_utilisateur: cleanUsername,
        email: cleanEmail,
      };

      setProfile((prev) => ({ ...prev, ...updatedUser }));
      if (updateUser) {
        updateUser(updatedUser);
      }
      window.dispatchEvent(new CustomEvent("user-updated", { detail: updatedUser }));

      notify("success", "Vos informations de compte ont été enregistrées avec succès !");
    } catch (err) {
      notify("error", err.message || "Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setSavingInfo(false);
    }
  }

  // ── Sauvegarde de l'avatar ──
  async function handleApplyAvatar(url) {
    const targetUrl = url !== undefined ? url : customAvatarUrl.trim();

    if (targetUrl) {
      if (/\.gif($|\?|#)/i.test(targetUrl.toLowerCase())) {
        notify("error", "Les fichiers .gif ne sont pas autorisés. Seuls les formats PNG, WEBP et JPEG sont acceptés.");
        return;
      }
      if (!isSafeUrl(targetUrl)) {
        notify("error", "Format d'image non valide. Seules les images PNG, WEBP et JPEG (http:// ou https://) sont acceptées.");
        return;
      }
    }

    try {
      setSavingAvatar(true);
      const res = await fetch(`${API_BASE_URL}/settings/avatar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar_url: targetUrl }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Impossible de mettre à jour l'avatar.");
      }

      setSelectedAvatarUrl(targetUrl);
      setProfile((prev) => ({ ...prev, avatar_url: targetUrl }));
      if (targetUrl) {
        addToRecentAvatars(targetUrl);
      }

      const updatedUser = { ...profile, avatar_url: targetUrl };
      if (updateUser) {
        updateUser(updatedUser);
      }
      window.dispatchEvent(new CustomEvent("user-updated", { detail: updatedUser }));

      notify("success", "Votre photo de profil a été mise à jour !");
      setCustomAvatarUrl("");
    } catch (err) {
      notify("error", err.message || "Erreur lors de la mise à jour de l'avatar.");
    } finally {
      setSavingAvatar(false);
    }
  }

  // ── Mise à jour du mot de passe ──
  async function handleUpdatePassword(e) {
    e.preventDefault();

    if (!newPassword || newPassword.length < 8) {
      notify("error", "Le nouveau mot de passe doit comporter au moins 8 caractères.");
      return;
    }

    if (newPassword.length > 128) {
      notify("error", "Le mot de passe ne doit pas dépasser 128 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      notify("error", "La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }

    try {
      setSavingPassword(true);
      const res = await fetch(`${API_BASE_URL}/settings/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Échec de la modification du mot de passe.");
      }

      notify("success", "Votre mot de passe a été modifié avec succès !");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      notify("error", err.message || "Erreur lors de la modification du mot de passe.");
    } finally {
      setSavingPassword(false);
    }
  }

  // ── Déconnexion ──
  function handleConfirmLogout() {
    setShowLogoutModal(false);
    logout();
    navigate("/login");
  }

  // Calcul visuel de la force du mot de passe
  function getPasswordStrength(pw) {
    if (!pw) return { score: 0, label: "", color: "#e2e8f0" };
    let score = 0;
    if (pw.length >= 8) score += 1;
    if (pw.length >= 12) score += 1;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score += 1;

    switch (score) {
      case 1:
        return { score: 25, label: "Très faible", color: "#ef4444" };
      case 2:
        return { score: 50, label: "Moyen", color: "#f59e0b" };
      case 3:
        return { score: 75, label: "Bon", color: "#3b82f6" };
      case 4:
        return { score: 100, label: "Très sécurisé", color: "#10b981" };
      default:
        return { score: 15, label: "Trop court", color: "#ef4444" };
    }
  }

  const pwStrength = getPasswordStrength(newPassword);

  // Formattage date de création
  const memberDate = profile.cree_le
    ? new Date(profile.cree_le).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    : "Récemment";

  return (
    <main className="settings-page">
      <div className="settings-container">
        {/* ── Topbar En-tête de page ───────────────────────────────────── */}
        <header className="settings-topbar">
          <div className="settings-heading">
            <div className="settings-title-row">
              <span className="settings-icon-badge">
                <i className="fa-solid fa-gear"></i>
              </span>
              <h1 className="settings-title">Paramètres du Compte</h1>
            </div>
          </div>
        </header>

        {/* ── Bandeau Notification / Toast ─────────────────────────────── */}
        {notification && (
          <div className={`settings-alert is-${notification.type}`} role="alert">
            <div className="settings-alert-content">
              <i
                className={`fa-solid fa-${notification.type === "success" ? "circle-check" : "circle-exclamation"
                  }`}
              ></i>
              <span>{notification.message}</span>
            </div>
            <button
              type="button"
              className="settings-alert-close"
              onClick={() => setNotification(null)}
              aria-label="Fermer la notification"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* ── Carte Profil Joueur Connecté (Hero Card) ──────────────────── */}
        <section className="settings-hero-card" aria-label="Profil du joueur connecté">
          <div className="settings-hero-main">
            {/* Avatar interactif avec indicateur actif */}
            <div
              className="settings-avatar-wrapper"
              onClick={() => {
                const avatarSection = document.getElementById("avatar-section");
                if (avatarSection) avatarSection.scrollIntoView({ behavior: "smooth" });
              }}
              title="Cliquer pour changer l'avatar"
            >
              <div className="settings-avatar-inner">
                {profile.avatar_url && isSafeUrl(profile.avatar_url) ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.nom_utilisateur || "Avatar"}
                    className="settings-avatar-img"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="settings-avatar-fallback">
                    {(profile.nom_utilisateur || "J")[0]}
                  </span>
                )}
                <div className="settings-avatar-overlay">
                  <i className="fa-solid fa-camera"></i>
                  <span>Modifier</span>
                </div>
              </div>
              <span className="settings-avatar-status-dot" title="En ligne"></span>
            </div>

            {/* Informations utilisateur du haut */}
            <div className="settings-hero-info">
              <div className="settings-hero-name-row">
                <span className="settings-hero-username">
                  {profile.nom_utilisateur || "Duelliste"}
                </span>
                <span
                  className={`settings-badge is-role-${profile.statut === "admin" ? "admin" : "active"
                    }`}
                >
                  <i
                    className={`fa-solid fa-${profile.statut === "admin" ? "crown" : "shield-halved"}`}
                  ></i>
                  {profile.statut === "admin" ? "Administrateur" : "Joueur Actif"}
                </span>
              </div>

              <div className="settings-hero-email">
                <i className="fa-regular fa-envelope"></i>
                <span>{profile.email || "Non renseigné"}</span>
              </div>

              <div className="settings-hero-meta-row">
                <div className="settings-meta-item is-credits">
                  <i className="fa-solid fa-coins"></i>
                  <span>
                    <strong>{Number(profile.credits || 0).toLocaleString("fr-FR")}</strong> crédits
                  </span>
                </div>
                <div className="settings-meta-item">
                  <i className="fa-regular fa-calendar-check"></i>
                  <span>Inscrit le {memberDate}</span>
                </div>
                {profile.github_id && (
                  <div className="settings-meta-item">
                    <i className="fa-brands fa-github"></i>
                    <span>Lié à GitHub</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action rapide défilement */}
            <button
              type="button"
              className="settings-hero-quick-btn"
              onClick={() => {
                const avatarSection = document.getElementById("avatar-section");
                if (avatarSection) avatarSection.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <i className="fa-solid fa-image"></i>
              <span>Changer d'avatar</span>
            </button>
          </div>
        </section>

        {/* ── Grille des Sections de Paramètres ─────────────────────────── */}
        <div className="settings-grid">
          {/* 1. Informations Personnelles (Nom d'utilisateur et Email) */}
          <section className="settings-panel">
            <div className="settings-panel-header">
              <div className="settings-panel-title-group">
                <div className="settings-panel-icon">
                  <i className="fa-solid fa-user-pen"></i>
                </div>
                <div>
                  <h2 className="settings-panel-title">Informations du Compte</h2>
                  <p className="settings-panel-desc">
                    Mettez à jour votre pseudonyme public et votre courriel de contact.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveProfileInfo}>
              <div className="settings-form-row">
                {/* Nom d'utilisateur */}
                <div className="settings-field">
                  <label htmlFor="settings-username" className="settings-label">
                    <span>Nom d'utilisateur</span>
                    <span className="settings-hint">Visible par les autres joueurs</span>
                  </label>
                  <div className="settings-input-container">
                    <i className="fa-solid fa-user settings-input-icon"></i>
                    <input
                      id="settings-username"
                      type="text"
                      className="settings-input"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="Ex: Kaiba99"
                      required
                      minLength={3}
                      maxLength={50}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="settings-field">
                  <label htmlFor="settings-email" className="settings-label">
                    <span>Adresse Courriel</span>
                    <span className="settings-hint">Utilisé pour la connexion</span>
                  </label>
                  <div className="settings-input-container">
                    <i className="fa-solid fa-envelope settings-input-icon"></i>
                    <input
                      id="settings-email"
                      type="email"
                      className="settings-input"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="joueur@m9tcg.local"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="settings-panel-footer">
                <button
                  type="button"
                  className="settings-secondary-btn"
                  onClick={() => {
                    setUsernameInput(profile.nom_utilisateur || "");
                    setEmailInput(profile.email || "");
                  }}
                  disabled={savingInfo}
                >
                  <i className="fa-solid fa-rotate-left"></i>
                  <span>Réinitialiser</span>
                </button>
                <button
                  type="submit"
                  className="settings-primary-btn"
                  disabled={savingInfo}
                >
                  {savingInfo ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk"></i>
                      <span>Sauvegarder les infos</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* 2. Photo de Profil (Avatar) */}
          <section id="avatar-section" className="settings-panel">
            <div className="settings-panel-header">
              <div className="settings-panel-title-group">
                <div className="settings-panel-icon">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                </div>
                <div>
                  <h2 className="settings-panel-title">Photo de Profil (Avatar)</h2>
                  <p className="settings-panel-desc">
                    Personnalisez votre apparence avec une URL d'image ou réutilisez l'un de vos avatars récents.
                  </p>
                </div>
              </div>
            </div>

            {/* Galerie des avatars récents de l'utilisateur */}
            <div className="settings-field">
              <div className="settings-label">
                <span>Avatars Récents</span>
                {recentAvatars.length > 0 && (
                  <button
                    type="button"
                    className="settings-text-link"
                    onClick={() => {
                      setRecentAvatars([]);
                      try {
                        localStorage.removeItem(recentStorageKey);
                      } catch (err) {
                        console.error("Erreur suppression historique avatars :", err);
                      }
                    }}
                    title="Effacer la liste des avatars récents"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                    <span>Effacer l'historique</span>
                  </button>
                )}
              </div>

              {recentAvatars.length > 0 ? (
                <div className="settings-avatar-presets">
                  {recentAvatars.map((url, idx) => {
                    const isSelected = (selectedAvatarUrl || profile.avatar_url) === url;
                    return (
                      <button
                        key={`${url}-${idx}`}
                        type="button"
                        className={`settings-preset-btn${isSelected ? " is-selected" : ""}`}
                        onClick={() => handleApplyAvatar(url)}
                        title="Cliquer pour réutiliser cet avatar"
                        disabled={savingAvatar}
                      >
                        <img
                          src={url}
                          alt={`Avatar récent ${idx + 1}`}
                          className="settings-preset-img"
                          loading="lazy"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                        {isSelected && (
                          <span className="settings-preset-check">
                            <i className="fa-solid fa-check"></i>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="settings-recent-empty">
                  <i className="fa-regular fa-images" style={{ fontSize: "1.75rem", color: "#94a3b8" }}></i>
                  <p style={{ margin: 0, fontWeight: 600 }}>Aucun avatar récent pour le moment.</p>
                  <span className="settings-hint">
                    Entrez une URL d'image ci-dessous pour ajouter votre photo de profil.
                  </span>
                </div>
              )}
            </div>

            {/* URL d'image personnalisée */}
            <div className="settings-field">
              <label htmlFor="settings-avatar-url" className="settings-label">
                <span>Ou entrez une URL d'avatar personnalisée</span>
                <span className="settings-hint">Formats acceptés : PNG, WEBP, JPEG (.gif refusé)</span>
              </label>
              <div className="settings-custom-url-box">
                <div className="settings-input-container" style={{ flex: 1 }}>
                  <i className="fa-solid fa-link settings-input-icon"></i>
                  <input
                    id="settings-avatar-url"
                    type="url"
                    className="settings-input"
                    value={customAvatarUrl}
                    onChange={(e) => setCustomAvatarUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                  />
                </div>
                <button
                  type="button"
                  className="settings-primary-btn"
                  onClick={() => handleApplyAvatar()}
                  disabled={savingAvatar || !customAvatarUrl.trim()}
                >
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                  <span>Appliquer l'URL</span>
                </button>
                {profile.avatar_url && (
                  <button
                    type="button"
                    className="settings-secondary-btn"
                    onClick={() => handleApplyAvatar("")}
                    disabled={savingAvatar}
                    title="Retirer la photo personnalisée et revenir à l'initiale"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                    <span>Retirer</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 3. Sécurité et Mot de Passe */}
          <section className="settings-panel">
            <div className="settings-panel-header">
              <div className="settings-panel-title-group">
                <div className="settings-panel-icon is-security">
                  <i className="fa-solid fa-shield-halved"></i>
                </div>
                <div>
                  <h2 className="settings-panel-title">Sécurité du Compte</h2>
                  <p className="settings-panel-desc">
                    Modifiez votre mot de passe pour protéger votre super méga précieuse collection de cartes qui est très importante à protéger.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdatePassword}>
              <div className="settings-form-row">
                {/* Ancien mot de passe */}
                <div className="settings-field">
                  <label htmlFor="settings-current-pw" className="settings-label">
                    <span>Mot de passe actuel</span>
                  </label>
                  <div className="settings-input-container">
                    <i className="fa-solid fa-key settings-input-icon"></i>
                    <input
                      id="settings-current-pw"
                      type={showCurrentPw ? "text" : "password"}
                      className="settings-input"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="settings-input-toggle-btn"
                      onClick={() => setShowCurrentPw((v) => !v)}
                      aria-label="Afficher ou masquer le mot de passe"
                    >
                      <i className={`fa-regular fa-${showCurrentPw ? "eye-slash" : "eye"}`}></i>
                    </button>
                  </div>
                </div>

                {/* Nouveau mot de passe */}
                <div className="settings-field">
                  <label htmlFor="settings-new-pw" className="settings-label">
                    <span>Nouveau mot de passe</span>
                  </label>
                  <div className="settings-input-container">
                    <i className="fa-solid fa-lock settings-input-icon"></i>
                    <input
                      id="settings-new-pw"
                      type={showNewPw ? "text" : "password"}
                      className="settings-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 caractères"
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="settings-input-toggle-btn"
                      onClick={() => setShowNewPw((v) => !v)}
                      aria-label="Afficher ou masquer le mot de passe"
                    >
                      <i className={`fa-regular fa-${showNewPw ? "eye-slash" : "eye"}`}></i>
                    </button>
                  </div>

                  {/* Indicateur de force */}
                  {newPassword && (
                    <div className="settings-pw-meter">
                      <div className="settings-pw-bar-bg">
                        <div
                          className="settings-pw-bar-fill"
                          style={{
                            width: `${pwStrength.score}%`,
                            backgroundColor: pwStrength.color,
                          }}
                        ></div>
                      </div>
                      <span className="settings-pw-meter-text" style={{ color: pwStrength.color }}>
                        Force : {pwStrength.label}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Confirmation nouveau mot de passe */}
              <div className="settings-field" style={{ marginTop: "1rem", maxWidth: "420px" }}>
                <label htmlFor="settings-confirm-pw" className="settings-label">
                  <span>Confirmer le nouveau mot de passe</span>
                  {confirmPassword && (
                    <span
                      className={`settings-hint ${confirmPassword === newPassword ? "" : "is-error"
                        }`}
                    >
                      {confirmPassword === newPassword ? "✓ Correspond" : "✗ Ne correspond pas"}
                    </span>
                  )}
                </label>
                <div className="settings-input-container">
                  <i className="fa-solid fa-circle-check settings-input-icon"></i>
                  <input
                    id="settings-confirm-pw"
                    type={showNewPw ? "text" : "password"}
                    className="settings-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Répétez le nouveau mot de passe"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="settings-panel-footer">
                <button
                  type="submit"
                  className="settings-primary-btn"
                  disabled={
                    savingPassword ||
                    !newPassword ||
                    newPassword.length < 8 ||
                    newPassword !== confirmPassword
                  }
                >
                  {savingPassword ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Modification en cours...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-shield"></i>
                      <span>Mettre à jour le mot de passe</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* 4. Préférences d'Apparence & Thème */}
          <section className="settings-panel">
            <div className="settings-panel-header">
              <div className="settings-panel-title-group">
                <div className="settings-panel-icon is-appearance">
                  <i className="fa-solid fa-palette"></i>
                </div>
                <div>
                  <h2 className="settings-panel-title">Préférences d'Affichage</h2>
                  <p className="settings-panel-desc">
                    Basculez entre le thème clair et le thème sombre selon votre confort visuel.
                  </p>
                </div>
              </div>
            </div>

            <div className="settings-theme-selector">
              {/* Option Thème Clair */}
              <div
                className={`settings-theme-card${!isDarkTheme ? " is-active" : ""}`}
                onClick={() => setIsDarkTheme(false)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setIsDarkTheme(false)}
              >
                <div className="settings-theme-preview light-preview">
                  <div className="preview-sidebar"></div>
                  <div className="preview-body">
                    <div className="preview-bar" style={{ width: "60%" }}></div>
                    <div className="preview-bar" style={{ width: "80%" }}></div>
                    <div className="preview-bar" style={{ width: "40%" }}></div>
                  </div>
                </div>
                <div className="settings-theme-info">
                  <span className="settings-theme-title">
                    <i className="fa-solid fa-sun" style={{ color: "#f59e0b" }}></i>
                    <span>Thème Clair</span>
                  </span>
                  <span className="settings-theme-radio"></span>
                </div>
              </div>

              {/* Option Thème Sombre */}
              <div
                className={`settings-theme-card${isDarkTheme ? " is-active" : ""}`}
                onClick={() => setIsDarkTheme(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setIsDarkTheme(true)}
              >
                <div className="settings-theme-preview dark-preview">
                  <div className="preview-sidebar"></div>
                  <div className="preview-body">
                    <div className="preview-bar" style={{ width: "60%" }}></div>
                    <div className="preview-bar" style={{ width: "80%" }}></div>
                    <div className="preview-bar" style={{ width: "40%" }}></div>
                  </div>
                </div>
                <div className="settings-theme-info">
                  <span className="settings-theme-title">
                    <i className="fa-solid fa-moon" style={{ color: "#60a5fa" }}></i>
                    <span>Thème Sombre</span>
                  </span>
                  <span className="settings-theme-radio"></span>
                </div>
              </div>
            </div>
          </section>

          {/* 5. Zone de Déconnexion / Session */}
          <section className="settings-panel settings-danger-card">
            <div className="settings-danger-content">
              <div className="settings-danger-info">
                <h4>Session et Déconnexion</h4>
                <p>
                  Vous êtes actuellement connecté avec le compte{" "}
                  <strong>{profile.nom_utilisateur || "votre compte"}</strong>. Pour fermer
                  votre session sur cet appareil, cliquez ci-dessous.
                </p>
              </div>
              <button
                type="button"
                className="settings-logout-btn"
                onClick={() => setShowLogoutModal(true)}
              >
                <i className="fa-solid fa-right-from-bracket"></i>
                <span>Se déconnecter</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* ── Modal de Confirmation de Déconnexion ───────────────────────── */}
      {showLogoutModal && (
        <div className="settings-modal-backdrop" onClick={() => setShowLogoutModal(false)}>
          <div
            className="settings-modal-box"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="settings-modal-icon">
              <i className="fa-solid fa-right-from-bracket"></i>
            </div>
            <div className="settings-modal-text">
              <h3>Confirmer la déconnexion ?</h3>
              <p>
                Vous allez être déconnecté de votre session M9 TCG. Vous devrez entrer à nouveau vos
                identifiants pour accéder à votre collection et à vos decks.
              </p>
            </div>
            <div className="settings-modal-actions">
              <button
                type="button"
                className="settings-secondary-btn"
                onClick={() => setShowLogoutModal(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="settings-logout-btn"
                onClick={handleConfirmLogout}
                style={{ justifyContent: "center" }}
              >
                <i className="fa-solid fa-check"></i>
                <span>Oui, me déconnecter</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Settings;