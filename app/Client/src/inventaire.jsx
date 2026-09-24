import Sidebar from './sidebar/Sidebar'

// Import Bulma CSS
import 'bulma/css/bulma.min.css';

function Inventaire() {
    return (
        <div className="tcg-layout">
            <Sidebar />

            <main className="content-left-spacing">
                {/* Titres */}
                <h1 className="inventory-title">Inventaire de cartes</h1>
                <p className="inventory-subtitle">C&apos;est trop bien les cartes ngl</p>
                <hr className="inventory-divider" />

                {/* Filtres */}

                <div className='filters'>
                    <div className="field">
                        <label className="label">Rechercher nom</label>
                        <div className="control">
                            <input className="input" type="text" placeholder="Text input" />
                        </div>
                    </div>
                </div>

                {/* Cartes */}
            </main>
        </div>
    )
}

export default Inventaire