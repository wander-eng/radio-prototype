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

        // Popup central
        this.popupText = document.createElement('div');
        this.popupText.className = 'hud-popup';

        this.container.appendChild(topLeft);
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
            // Efeito de "soco" no texto do combo
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
        
        // Some sozinho após ~1.2s
        this.popupTimeout = window.setTimeout(() => {
            this.popupText.classList.remove('show');
        }, 1200);
    }

    // Scaffolding do HP do Jogador
    public updatePlayerHP(current: number, max: number) {
        const percentage = Math.max(0, (current / max) * 100);
        this.playerHpFill.style.width = `${percentage}%`;
    }
}