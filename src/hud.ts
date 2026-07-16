export type EnergyHudState = 'empty' | 'charging' | 'full';

export function energyHudState(current: number, max: number = 100): EnergyHudState {
    if (current <= 0) return 'empty';
    if (current >= max) return 'full';
    return 'charging';
}

export const HUD_CONTROL_HINTS = [
    'Mover: <kbd>WASD</kbd> / <kbd>Setas</kbd>',
    'Ataque: <kbd>LMB</kbd>',
    'Pular: <kbd>Espaço</kbd> (x2)',
    'Dash: <kbd>Shift</kbd> / <kbd>RMB</kbd>',
    'Rádio: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> / <kbd>Scroll</kbd>',
    'Transformação: <kbd>R</kbd>',
    'Pausar: <kbd>ESC</kbd>'
];

export class UIManager {
    private container: HTMLDivElement;
    private stationText: HTMLDivElement;
    private comboText: HTMLDivElement;
    private popupText: HTMLDivElement;
    private playerHpFill: HTMLDivElement;
    private energyContainer: HTMLDivElement;
    private energyBar: HTMLDivElement;
    private energyFill: HTMLDivElement;
    private energyStatus: HTMLDivElement;
    private startMessage: HTMLDivElement;
    
    private pauseOverlay: HTMLDivElement;
    public isPaused = false;
    
    public onMusicVolumeChange?: (val: number) => void;
    public onSfxVolumeChange?: (val: number) => void;
    
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

        this.energyContainer = document.createElement('div');
        this.energyContainer.className = 'hud-energy';

        const energyLabel = document.createElement('div');
        energyLabel.className = 'hud-energy-label';
        energyLabel.innerText = 'CARGA DE TRANSFORMAÇÃO';

        this.energyBar = document.createElement('div');
        this.energyBar.className = 'hud-energy-bg';
        this.energyBar.setAttribute('role', 'progressbar');
        this.energyBar.setAttribute('aria-label', 'Carga de transformação');
        this.energyBar.setAttribute('aria-valuemin', '0');
        this.energyBar.setAttribute('aria-valuemax', '100');

        this.energyFill = document.createElement('div');
        this.energyFill.className = 'hud-energy-fill';
        this.energyBar.appendChild(this.energyFill);

        this.energyStatus = document.createElement('div');
        this.energyStatus.className = 'hud-energy-status';

        this.energyContainer.appendChild(energyLabel);
        this.energyContainer.appendChild(this.energyBar);
        this.energyContainer.appendChild(this.energyStatus);

        topLeft.appendChild(this.stationText);
        topLeft.appendChild(this.comboText);
        topLeft.appendChild(hpBg);
        topLeft.appendChild(this.energyContainer);

        const topRight = document.createElement('div');
        topRight.className = 'hud-top-right';
        
        // ATUALIZADO: Letreiro com Pular em vez de Ataque no Espaço
        topRight.innerHTML = `
            <div class="hud-controls-title">CONTROLES</div>
            <div class="hud-controls-hint">
                ${HUD_CONTROL_HINTS.join('<br>')}
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

        this.updateEnergy(0);
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
        this.energyFill.style.backgroundColor = colorHex;
        this.energyFill.style.boxShadow = `0 0 10px ${colorHex}`;
        this.energyStatus.style.color = colorHex;
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

    public updateEnergy(current: number, max: number = 100) {
        const safeMax = Math.max(1, max);
        const clampedEnergy = Math.min(safeMax, Math.max(0, current));
        const percentage = (clampedEnergy / safeMax) * 100;
        const state = energyHudState(clampedEnergy, safeMax);

        this.energyFill.style.width = `${percentage}%`;
        this.energyBar.setAttribute('aria-valuenow', String(clampedEnergy));
        this.energyContainer.dataset.state = state;

        if (state === 'empty') this.energyStatus.innerText = 'SEM ENERGIA';
        if (state === 'charging') this.energyStatus.innerText = 'CARREGANDO';
        if (state === 'full') this.energyStatus.innerText = 'TRANSFORMAÇÃO DISPONÍVEL';
    }
}
