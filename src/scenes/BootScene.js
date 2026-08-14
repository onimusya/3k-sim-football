// Boot Scene - Generate all game textures procedurally
export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Create loading bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

        const loadingText = this.add.text(width / 2, height / 2 - 50, '三國蹴鞠', {
            font: '28px serif',
            fill: '#c4a44e'
        }).setOrigin(0.5);

        const percentText = this.add.text(width / 2, height / 2, '0%', {
            font: '18px monospace',
            fill: '#ffffff'
        }).setOrigin(0.5);

        this.load.on('progress', (value) => {
            percentText.setText(parseInt(value * 100) + '%');
            progressBar.clear();
            progressBar.fillStyle(0xc4a44e, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });
    }

    create() {
        // Generate textures procedurally
        this.generateTextures();
        
        // Initialize game state
        this.registry.set('gameState', {
            playerKingdom: null,
            season: 1,
            week: 1,
            money: 1500,
            gold: 1500,
            reputation: 50,
            results: [],
            leagueTable: null,
            matchesThisSeason: 0,
            seasonComplete: false,
            initialized: false,
            facilities: { trainingGround: 1, medicalTent: 0, scoutNetwork: 0 },
            trophies: [],
            sponsorBonus: 0,
            scoutBonus: false,
            weatherPenalty: null,
            challengeMatch: false,
            pendingEvent: null,
            lastEvent: null,
            lastMatchWon: false,
        });

        this.scene.start('MainMenuScene');
    }

    generateTextures() {
        // Player sprite (circle with shirt)
        this.generatePlayerSprite('player_home', 0xcc3333);
        this.generatePlayerSprite('player_away', 0x3333cc);
        this.generatePlayerSprite('player_wei', 0x1a4d8f);
        this.generatePlayerSprite('player_shu', 0x8b1a1a);
        this.generatePlayerSprite('player_wu', 0x1a6b3a);
        this.generatePlayerSprite('player_dong', 0x4a1a4a);
        this.generatePlayerSprite('player_yuan', 0x8b7d1a);
        this.generatePlayerSprite('player_lu', 0x6b1a1a);

        // Ball
        const ballGfx = this.make.graphics({ x: 0, y: 0, add: false });
        ballGfx.fillStyle(0xffffff, 1);
        ballGfx.fillCircle(6, 6, 6);
        ballGfx.fillStyle(0x333333, 1);
        ballGfx.fillCircle(4, 4, 2);
        ballGfx.fillCircle(8, 4, 2);
        ballGfx.fillCircle(6, 8, 2);
        ballGfx.generateTexture('ball', 12, 12);

        // Goal post
        const goalGfx = this.make.graphics({ x: 0, y: 0, add: false });
        goalGfx.fillStyle(0xffffff, 1);
        goalGfx.fillRect(0, 0, 8, 80);
        goalGfx.generateTexture('goalpost', 8, 80);

        // Pitch texture
        const pitchGfx = this.make.graphics({ x: 0, y: 0, add: false });
        pitchGfx.fillStyle(0x2d5a1e, 1);
        pitchGfx.fillRect(0, 0, 800, 500);
        // Lighter stripes
        for (let i = 0; i < 10; i++) {
            pitchGfx.fillStyle(i % 2 === 0 ? 0x2d5a1e : 0x336b22, 1);
            pitchGfx.fillRect(i * 80, 0, 80, 500);
        }
        pitchGfx.generateTexture('pitch', 800, 500);

        // Button texture
        const btnGfx = this.make.graphics({ x: 0, y: 0, add: false });
        btnGfx.fillStyle(0x8b6914, 1);
        btnGfx.fillRoundedRect(0, 0, 200, 50, 8);
        btnGfx.lineStyle(2, 0xc4a44e, 1);
        btnGfx.strokeRoundedRect(0, 0, 200, 50, 8);
        btnGfx.generateTexture('button', 200, 50);

        // Panel background
        const panelGfx = this.make.graphics({ x: 0, y: 0, add: false });
        panelGfx.fillStyle(0x1a0a00, 0.95);
        panelGfx.fillRoundedRect(0, 0, 400, 300, 12);
        panelGfx.lineStyle(3, 0x8b6914, 1);
        panelGfx.strokeRoundedRect(0, 0, 400, 300, 12);
        panelGfx.generateTexture('panel', 400, 300);

        // Star/particle
        const starGfx = this.make.graphics({ x: 0, y: 0, add: false });
        starGfx.fillStyle(0xffdd44, 1);
        starGfx.fillCircle(4, 4, 4);
        starGfx.generateTexture('particle', 8, 8);

        // Banner decoration
        const bannerGfx = this.make.graphics({ x: 0, y: 0, add: false });
        bannerGfx.fillStyle(0x8b6914, 1);
        bannerGfx.fillRect(0, 0, 300, 4);
        bannerGfx.fillStyle(0xc4a44e, 1);
        bannerGfx.fillRect(0, 0, 60, 4);
        bannerGfx.fillRect(240, 0, 60, 4);
        bannerGfx.generateTexture('banner_line', 300, 4);
    }

    generatePlayerSprite(key, color) {
        const gfx = this.make.graphics({ x: 0, y: 0, add: false });
        // Body
        gfx.fillStyle(color, 1);
        gfx.fillCircle(12, 12, 10);
        // Head
        gfx.fillStyle(0xf5d5a0, 1);
        gfx.fillCircle(12, 6, 5);
        // Number spot
        gfx.fillStyle(0xffffff, 1);
        gfx.fillCircle(12, 14, 3);
        gfx.generateTexture(key, 24, 24);
    }
}
