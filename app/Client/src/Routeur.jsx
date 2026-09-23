import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Collection from "./Pages/Collection"

function Routeur() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/collection" element={<Collection />} />
                {/* 
                    Insérer vos pages ici, au dessus du Route path="*"
                */}
                <Route path="*" element={
                    <div className="section has-text-centered">Page non trouvée</div>
                }
                />
            </Routes>
        </BrowserRouter>
    )
}