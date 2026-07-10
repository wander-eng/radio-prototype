export class UIManager {
    private container: HTMLDivElement;
    private stationText: HTMLDivElement;
    private comboText: HTMLDivElement;
    private popupText: HTMLDivElement;
    private playerHpFill: HTMLDivElement;
    private startMessage: HTMLDivElement;
    
    private pauseOverlay: HTMLDivElement;
    public isPaused = false;
    
    // Callbacks do Menu e Áudio
    public onMusicVolumeChange?: (val: number) => void;
    public onSfxVolumeChange?: (val: number) => void;
    
    // NOVO: Callbacks de Estado do Jogo
    public onPause?: () => void;
    public onResume?: () => void;

    private popupTimeout: number | null = null;

    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'hud-container';

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

        const topRight = document.createElement('div');
        topRight.className = 'hud-top-right';
        topRight.innerHTML = `
            <div class="hud-controls-title">CONTROLES</div>
            <div class="hud-controls-hint">
                Mover: <kbd>WASD</kbd> ou <kbd>Setas</kbd><br>
                Ataque: <kbd>Espaço</kbd> ou <kbd>LMB</kbd><br>
                Dash: <kbd>Shift</kbd> ou <kbd>RMB</kbd><br>
                Rádio: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> ou <kbd>Scroll</kbd><br>
                Pausar: <kbd>ESC</kbd>
            </div>
        `;

        this.popupText = document.createElement('div');
        this.popupText.className = 'hud-popup';

        this.startMessage = document.createElement('div');
        this.startMessage.className = 'hud-start-message';
        this.startMessage.innerText = 'PRESSIONE QUALQUER TECLA PARA COMEÇAR';

        this.container.appendChild(topLeft);
        this.container.appendChild(topRight);
        this.container.appendChild(this.popupText);
        this.container.appendChild(this.startMessage);
        
        document.body.appendChild(this.container);

        this.pauseOverlay = document.createElement('div');
        this.pauseOverlay.id = 'pause-overlay';
        this.pauseOverlay.className = 'hidden';
        
        this.pauseOverlay.innerHTML = `
            <div id="pause-menu" class="menu-box">
                <h2>PAUSADO</h2>
                <button id="btn-resume">RETOMAR</button>
                <button id="btn-settings">CONFIGURAÇÕES</button>
                <button id="btn-exit">SAIR</button>
            </div>
            <div id="settings-menu" class="menu-box hidden">
                <h2>CONFIGURAÇÕES</h2>
                <div class="slider-group">
                    <label>VOLUME DA MÚSICA</label>
                    <input type="range" id="vol-music" min="0" max="1" step="0.05" value="1">
                </div>
                <div class="slider-group">
                    <label>VOLUME DOS EFEITOS (SFX)</label>
                    <input type="range" id="vol-sfx" min="0" max="1" step="0.05" value="1">
                </div>
                <button id="btn-back">VOLTAR</button>
            </div>
        `;
        document.body.appendChild(this.pauseOverlay);

        document.getElementById('btn-resume')!.onclick = () => this.resumeGame();
        document.getElementById('btn-settings')!.onclick = () => this.openSettings();
        document.getElementById('btn-exit')!.onclick = () => window.location.reload();
        document.getElementById('btn-back')!.onclick = () => this.openPauseMenu();

        const volMusic = document.getElementById('vol-music') as HTMLInputElement;
        volMusic.oninput = () => {
            if (this.onMusicVolumeChange) this.onMusicVolumeChange(parseFloat(volMusic.value));
        };

        const volSfx = document.getElementById('vol-sfx') as HTMLInputElement;
        volSfx.oninput = () => {
            if (this.onSfxVolumeChange) this.onSfxVolumeChange(parseFloat(volSfx.value));
        };
    }

    public handleEscape() {
        if (!this.isPaused) {
            this.pauseGame();
        } else {
            const settingsMenu = document.getElementById('settings-menu')!;
            if (!settingsMenu.classList.contains('hidden')) {
                this.openPauseMenu();
            } else {
                this.resumeGame();
            }
        }
    }

    // NOVO: Dispara os callbacks quando pausa ou despausa
    private pauseGame() {
        this.isPaused = true;
        this.pauseOverlay.classList.remove('hidden');
        this.openPauseMenu();
        if (this.onPause) this.onPause();
    }

    private resumeGame() {
        this.isPaused = false;
        this.pauseOverlay.classList.add('hidden');
        if (this.onResume) this.onResume();
    }

    private openSettings() {
        document.getElementById('pause-menu')!.classList.add('hidden');
        document.getElementById('settings-menu')!.classList.remove('hidden');
    }

    private openPauseMenu() {
        document.getElementById('settings-menu')!.classList.add('hidden');
        document.getElementById('pause-menu')!.classList.remove('hidden');
    }

    public hideStartMessage() {
        this.startMessage.style.display = 'none';
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