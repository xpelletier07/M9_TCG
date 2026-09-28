import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Collection from "./Pages/Collection"
import Inventaire from "./inventaire"

function Routeur() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/collection" element={<Collection />} />
                <Route path="/inventaire" element={<Inventaire />} />
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

export default Routeur