export class UIManager {
    private container: HTMLDivElement;
    private stationText: HTMLDivElement;
    private comboText: HTMLDivElement;
    private popupText: HTMLDivElement;
    private playerHpFill: HTMLDivElement;
    
    private popupTimeout: number | null = null;

    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'hud-container';

        // Container superior esquerdo
        const topLeft = document.createElement('div');
        topLeft.className = 'hud-top-left';

        this.stationText = document.createElement('div');
        this.stationText.className = 'hud-station';
        this.stationText.innerText = 'SINTONIZANDO...';

        this.comboText = document.createElement('div');
        this.comboText.className = 'hud-combo';
        this.comboText.innerText = '';

        const hpBg = document.createElement('div');
        hpBg.className = 'hud-player-hp-bg';
        this.playerHpFill = document.createElement('div');
        this.playerHpFill.className = 'hud-player-hp-fill';
        hpBg.appendChild(this.playerHpFill);

        topLeft.appendChild(this.stationText);
        topLeft.appendChild(this.comboText);
        topLeft.appendChild(hpBg);

        // NOVO: Container superior direito (Controles)
        const topRight = document.createElement('div');
        topRight.className = 'hud-top-right';
        topRight.innerHTML = `
            <div class="hud-controls-title">CONTROLES</div>
            <div class="hud-controls-hint">
                Mover: <kbd>WASD</kbd> ou <kbd>Setas</kbd><br>
                Ataque: <kbd>Espaço</kbd> ou <kbd>LMB</kbd><br>
                Dash: <kbd>Shift</kbd> ou <kbd>RMB</kbd><br>
                Rádio: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> ou <kbd>Scroll</kbd>
            </div>
        `;

        // Popup central
        this.popupText = document.createElement('div');
        this.popupText.className = 'hud-popup';

        this.container.appendChild(topLeft);
        this.container.appendChild(topRight);
        this.container.appendChild(this.popupText);
        document.body.appendChild(this.container);
    }

    public setStation(name: string, colorHex: string) {
        this.stationText.innerText = `RÁDIO: ${name}`;
        this.stationText.style.color = colorHex;
        this.playerHpFill.style.backgroundColor = colorHex;
        this.playerHpFill.style.boxShadow = `0 0 8px ${colorHex}`;
    }

    public updateCombo(combo: number) {
        if (combo > 0) {
            this.comboText.innerText = `${combo} HITS`;
            this.comboText.style.transform = 'scale(1.2)';
            setTimeout(() => this.comboText.style.transform = 'scale(1)', 50);
        } else {
            this.comboText.innerText = '';
        }
    }

    public showPopup(text: string, colorHex: string) {
        this.popupText.innerText = text;
        this.popupText.style.color = colorHex;
        this.popupText.classList.add('show');

        if (this.popupTimeout) clearTimeout(this.popupTimeout);
        
        this.popupTimeout = window.setTimeout(() => {
            this.popupText.classList.remove('show');
        }, 1200);
    }

    public updatePlayerHP(current: number, max: number) {
        const percentage = Math.max(0, (current / max) * 100);
        this.playerHpFill.style.width = `${percentage}%`;
    }
}