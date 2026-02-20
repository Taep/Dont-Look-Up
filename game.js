export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();

        this.lastTime = 0;
        this.accumulator = 0;
        this.tickRate = 1000 / 60;

        // Asset loader
        this.assets = {};
        this.loadAsset('planet', 'assets/planet.jpeg');

        // Game State
        this.wave = 1;
        this.credits = 99999;
        this.baseHp = 100;
        this.maxBaseHp = 100;
        this.isGameOver = false;
        this.isPlaying = false;
        this.spawnTimer = 0;
        this.enemiesToSpawn = 0;

        // Entities
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.particles = [];
        this.capitalShips = [];
        this.clouds = [];
        this.debris = [];
        this.damageTexts = [];
        this.explosions = [];

        // Planet approach — continuous, never stops, accelerates over time
        this.planetApproach = 0;       // 0 ~ 1 continuous approach
        this.screenShake = 0;          // Shake intensity
        this.spawnFlash = 0;           // Flash when enemies spawn from planet

        // Visuals
        this.stars = this.generateStars(300);
        this.generateClouds();
        this.generateDebris();

        // Tower selection
        this.selectedTowerType = 'turret';
        this.towerCosts = { turret: 50, laser: 75, shield: 100, missile: 125, tesla: 150 };

        // Input
        this.mouseX = 0;
        this.mouseY = 0;
        this.canvas.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });
        this.canvas.addEventListener('click', (e) => this.handleInput(e));

        // Keyboard shortcuts for tower selection
        window.addEventListener('keydown', (e) => {
            if (e.key === '1') this.selectTower('turret');
            if (e.key === '2') this.selectTower('laser');
            if (e.key === '3') this.selectTower('shield');
            if (e.key === '4') this.selectTower('missile');
            if (e.key === '5') this.selectTower('tesla');
        });

        // Tower bar click handlers
        document.querySelectorAll('.tower-opt').forEach(el => {
            el.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this.selectTower(el.dataset.type);
            });
        });

        // UI Bindings
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.startGame());
        window.addEventListener('resize', () => this.resize());

        // Start Loop
        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
        this.generateCityLayers();
        this.generateClouds();
    }

    loadAsset(name, src) {
        const img = new Image();
        img.src = src;
        img.onload = () => { this.assets[name] = img; };
    }

    generateStars(count) {
        let stars = [];
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height * 0.6,
                size: Math.random() * 1.5 + 0.5,
                alpha: Math.random() * 0.8 + 0.2,
                twinkleSpeed: Math.random() * 0.05 + 0.01
            });
        }
        return stars;
    }

    generateClouds() {
        this.clouds = [];
        for (let i = 0; i < 20; i++) {
            this.clouds.push({
                x: Math.random() * this.width * 1.5 - this.width * 0.25,
                y: this.height * 0.3 + Math.random() * this.height * 0.35,
                w: 150 + Math.random() * 400,
                h: 30 + Math.random() * 60,
                speed: 0.05 + Math.random() * 0.15,
                opacity: 0.05 + Math.random() * 0.15
            });
        }
    }

    generateDebris() {
        this.debris = [];
        // Initial burst — spread across the whole sky so it looks like a meteor shower already in progress
        for (let i = 0; i < 300; i++) {
            const d = this.createDebris();
            // All start from the top edge, spread horizontally
            d.x = Math.random() * this.width * 1.4 - this.width * 0.2;
            d.y = -Math.random() * 150;
            d.life = Math.random() * 300;
            this.debris.push(d);
        }
    }

    createDebris() {
        const isMedium = Math.random() < this.planetApproach * 0.5;
        return {
            x: Math.random() * this.width,
            y: -20 - Math.random() * 80,
            size: isMedium ? 1.5 + Math.random() * 2.5 : 0.5 + Math.random() * 1.5,
            speed: isMedium ? 0.3 + Math.random() * 0.8 : 0.15 + Math.random() * 0.5,
            angle: Math.PI * 0.3 + Math.random() * 0.5,
            trailLen: isMedium ? 25 + Math.random() * 50 : 8 + Math.random() * 25,
            life: Math.random() * 1000,
            brightness: isMedium ? 0.4 + Math.random() * 0.5 : 0.2 + Math.random() * 0.6
        };
    }

    generateCityLayers() {
        this.cityLayers = [];
        // Layer 1: Far background - shorter, darker
        this.cityLayers.push(this.createCityLayer(0.40, '#080c18', '#0a1020', 50, 0.6));
        // Layer 2: Mid - taller, some detail
        this.cityLayers.push(this.createCityLayer(0.60, '#060a14', '#0c1428', 30, 0.8));
        // Layer 3: Foreground - tallest, most detail, frames the sky
        this.cityLayers.push(this.createCityLayer(0.85, '#030508', '#06090f', 18, 1.0));
    }

    createCityLayer(heightScale, color, lightColor, stepSize, angleMult) {
        let buildings = [];
        const steps = Math.ceil(this.width / stepSize);
        for (let i = 0; i <= steps; i++) {
            let x = i * stepSize;

            // Fish-eye: distance from center normalized 0-1
            let distFromCenter = Math.abs(x - this.width / 2) / (this.width / 2);

            // Extreme curve: buildings at edge are VERY tall, center ones are short
            // This creates the "canyon looking up" effect from the reference images
            let curve = Math.pow(distFromCenter, 1.2) * 0.9 + 0.1;

            // Building height - dramatically taller at edges
            let baseH = (this.height * heightScale) * curve;
            let h = baseH * (0.7 + Math.random() * 0.6);

            // Extreme lean angle: buildings lean inward toward sky center
            // At the very edge, buildings lean ~25-35 degrees inward
            let maxAngle = 0.5 * angleMult; // ~28 degrees max
            let angle = 0;
            if (x < this.width / 2) {
                // Left side: lean right (positive angle)
                angle = distFromCenter * distFromCenter * maxAngle;
            } else {
                // Right side: lean left (negative angle)
                angle = -distFromCenter * distFromCenter * maxAngle;
            }

            // Window lights
            let windows = [];
            let rows = Math.floor(h / 10);
            let cols = Math.floor(stepSize / 7);
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (Math.random() > 0.8) {
                        windows.push({
                            rx: c * 7 + 2,
                            ry: r * 10 + 5,
                            bright: Math.random()
                        });
                    }
                }
            }

            // Rooftop antenna/spire chance
            let hasSpire = Math.random() > 0.7;
            let spireH = hasSpire ? h * (0.1 + Math.random() * 0.15) : 0;

            buildings.push({
                x, y: this.height,
                w: stepSize + 1, h: -h,
                angle, windows,
                spireH, color, lightColor
            });
        }
        return { buildings, color, lightColor };
    }

    selectTower(type) {
        this.selectedTowerType = type;
        document.querySelectorAll('.tower-opt').forEach(el => {
            el.classList.toggle('selected', el.dataset.type === type);
        });
    }

    startGame() {
        this.isPlaying = true;
        this.isGameOver = false;
        this.wave = 1;
        this.credits = 99999;
        this.baseHp = 100;
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.capitalShips = [];
        this.particles = [];
        this.damageTexts = [];
        this.explosions = [];
        this.planetApproach = 0;
        this.screenShake = 0;
        this.spawnFlash = 0;
        this.selectedTowerType = 'turret';
        this.selectTower('turret');

        this.startWave();

        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('tower-bar').classList.remove('hidden');
        this.updateHud();
    }

    startWave() {
        // Screen shake on wave transition — stronger as planet is closer
        this.screenShake = Math.min(12, 1 + this.planetApproach * 15);

        // Enemy count — moderate start, escalates with waves
        const approachBonus = Math.floor(this.planetApproach * 15);
        this.enemiesToSpawn = 8 + (this.wave * 5) + approachBonus;
        this.spawnTimer = 0;

        // Capital ships more frequent as planet approaches
        const shipChance = this.planetApproach > 0.3 ? 0.8 : 0.4;
        if (this.wave % 2 === 0 || Math.random() < shipChance) {
            this.capitalShips.push(new CapitalShip(this.width, this.height));
        }
        if (this.planetApproach > 0.5 && Math.random() < 0.5) {
            this.capitalShips.push(new CapitalShip(this.width, this.height));
        }

        // Spawn extra debris as planet gets closer — meteor shower intensifies
        const extraDebris = Math.floor(this.planetApproach * 40) + 10;
        for (let i = 0; i < extraDebris; i++) {
            const nd = this.createDebris();
            nd.y = -20 - Math.random() * 100;
            this.debris.push(nd);
        }
    }

    handleInput(e) {
        if (!this.isPlaying || this.isGameOver) return;

        const cost = this.towerCosts[this.selectedTowerType];
        if (this.credits >= cost) {
            for (let t of this.towers) {
                if (Math.hypot(e.clientX - t.x, e.clientY - t.y) < 30) return;
            }

            let tower;
            switch (this.selectedTowerType) {
                case 'laser': tower = new LaserTower(e.clientX, e.clientY); break;
                case 'shield': tower = new ShieldGenerator(e.clientX, e.clientY); break;
                case 'missile': tower = new MissileTower(e.clientX, e.clientY); break;
                case 'tesla': tower = new TeslaTower(e.clientX, e.clientY); break;
                default: tower = new Tower(e.clientX, e.clientY); break;
            }

            this.towers.push(tower);
            this.credits -= cost;
            this.spawnParticles(e.clientX, e.clientY, 10, tower.color);
            this.updateHud();
        }
    }

    spawnEnemy() {
        let x = this.width * 0.2 + Math.random() * this.width * 0.6;
        let y = -50;
        let targetX = this.width * 0.15 + Math.random() * this.width * 0.7;
        let targetY = this.height + 50;

        const roll = Math.random();
        const w = this.wave;
        const pa = this.planetApproach;

        if (w >= 3 && roll < 0.08 + w * 0.01) {
            // Splitter — rare, increases with wave
            this.enemies.push(new SplitterEnemy(x, y, targetX, targetY, w, pa));
        } else if (w >= 2 && roll < 0.20 + w * 0.015) {
            // Tank — beefy, slow
            this.enemies.push(new TankEnemy(x, y, targetX, targetY, w, pa));
        } else if (w >= 2 && roll < 0.40 + w * 0.02) {
            // Swarm — spawn 3 small fast enemies
            for (let i = 0; i < 3; i++) {
                let sx = x + (Math.random() - 0.5) * 40;
                let sy = y - Math.random() * 30;
                this.enemies.push(new SwarmEnemy(sx, sy, targetX + (Math.random() - 0.5) * 60, targetY, w, pa));
            }
        } else {
            // Standard meteor
            this.enemies.push(new Enemy(x, y, targetX, targetY, w, pa));
        }

        this.spawnFlash = 0.6;
    }

    spawnParticles(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    spawnDamageText(x, y, amount, color = '#ffcc00') {
        this.damageTexts.push(new DamageText(x, y, amount, color));
    }

    spawnExplosion(x, y, color = '#ff0055', radius = 50) {
        this.explosions.push(new Explosion(x, y, color, radius));
    }

    update(dt) {
        if (!this.isPlaying || this.isGameOver) return;

        // Planet continuously approaches — never stops, accelerates each wave
        // Slow crawl early, relentless acceleration later → dread builds non-stop
        const approachSpeed = (0.00006 + this.wave * 0.00003) * (dt / 16);
        this.planetApproach = Math.min(0.95, this.planetApproach + approachSpeed);
        // Screen shake decay
        this.screenShake *= 0.95;
        if (this.screenShake < 0.1) this.screenShake = 0;

        // Spawn flash decay
        this.spawnFlash *= 0.92;

        // Cloud animation
        this.clouds.forEach(c => {
            c.x += c.speed;
            if (c.x > this.width + 300) c.x = -300;
        });

        // Debris animation (falling burning fragments)
        this.debris.forEach((d, idx) => {
            d.x += Math.cos(d.angle) * d.speed * dt * 0.05;
            d.y += Math.sin(d.angle) * d.speed * dt * 0.05;
            d.life += dt;
            if (d.y > this.height || d.x < -50 || d.x > this.width + 50) {
                const nd = this.createDebris();
                nd.y = -20;
                nd.life = 0;
                this.debris[idx] = nd;
            }
        });

        // Wave Logic — spawn rate intensifies with planet approach
        if (this.enemiesToSpawn > 0) {
            this.spawnTimer += dt;
            // Steady spawn, ramps up over waves
            const baseInterval = 700 - Math.min(450, this.wave * 30);
            const approachSpeedup = 1.0 - this.planetApproach * 0.5;
            const spawnInterval = Math.max(150, baseInterval * approachSpeedup);
            if (this.spawnTimer > spawnInterval) {
                this.spawnEnemy();
                this.enemiesToSpawn--;
                this.spawnTimer = 0;
            }
        } else if (this.enemies.length === 0) {
            this.wave++;
            this.startWave();
            this.updateHud();
        }

        // Entities Update
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let e = this.enemies[i];
            e.update(dt);

            if (e.y > this.height - 50) {
                this.baseHp -= 10;
                this.spawnParticles(e.x, this.height, 20, '#ff0055');
                this.enemies.splice(i, 1);
                this.updateHud();
                if (this.baseHp <= 0) this.gameOver();
            }
        }

        this.towers.forEach(t => t.update(dt, this.enemies, this));

        for (let i = this.capitalShips.length - 1; i >= 0; i--) {
            this.capitalShips[i].update(dt);
            if (this.capitalShips[i].x < -500 || this.capitalShips[i].x > this.width + 500) {
                this.capitalShips.splice(i, 1);
            }
        }

        // Projectiles Update
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            p.update(dt);

            let hit = false;
            if (p.life <= 0 || p.y < -100 || p.x < -100 || p.x > this.width + 100) {
                this.projectiles.splice(i, 1);
                continue;
            }

            for (let j = this.enemies.length - 1; j >= 0; j--) {
                let e = this.enemies[j];
                if (e.hp <= 0) continue; // Already dead from laser/shield
                if (Math.hypot(p.x - e.x, p.y - e.y) < e.size + p.size) {
                    e.hp -= p.damage;
                    this.spawnDamageText(e.x, e.y - 15, Math.round(p.damage), p.splash ? '#ff8800' : '#ffcc00');
                    this.spawnParticles(e.x, e.y, p.splash ? 12 : 5, '#ffa500');
                    hit = true;
                    // Splash damage (missiles)
                    if (p.splash) {
                        this.spawnExplosion(p.x, p.y, '#ff8800', p.splash);
                        this.screenShake = Math.max(this.screenShake, 4);
                        for (let k = this.enemies.length - 1; k >= 0; k--) {
                            let se = this.enemies[k];
                            if (se === e || se.hp <= 0) continue;
                            if (Math.hypot(p.x - se.x, p.y - se.y) < p.splash) {
                                let splashDmg = Math.round(p.damage * 0.5);
                                se.hp -= splashDmg;
                                this.spawnDamageText(se.x, se.y - 15, splashDmg, '#ff8800');
                            }
                        }
                    }
                    if (e.hp <= 0) {
                        this.credits += e.reward;
                        this.spawnParticles(e.x, e.y, 25, '#ff0055');
                        this.spawnExplosion(e.x, e.y, '#ff4400', 60);
                        this.screenShake = Math.max(this.screenShake, 2);
                        // Splitter spawns children on death
                        if (e.type === 'splitter') {
                            for (let s = 0; s < 3; s++) {
                                let sx = e.x + (Math.random() - 0.5) * 30;
                                let sy = e.y + (Math.random() - 0.5) * 30;
                                let tx = this.width * 0.2 + Math.random() * this.width * 0.6;
                                this.enemies.push(new SwarmEnemy(sx, sy, tx, this.height + 50, this.wave, this.planetApproach));
                            }
                            this.spawnExplosion(e.x, e.y, '#aa44ff', 45);
                        }
                        this.enemies.splice(j, 1);
                        this.updateHud();
                    }
                    break;
                }
            }

            if (hit) {
                this.projectiles.splice(i, 1);
            }
        }

        // Cleanup enemies killed by laser/shield (not caught by projectile loop)
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (this.enemies[i].hp <= 0) {
                const de = this.enemies[i];
                this.credits += de.reward;
                this.spawnParticles(de.x, de.y, 25, '#ff0055');
                this.spawnExplosion(de.x, de.y, '#ff4400', 60);
                this.screenShake = Math.max(this.screenShake, 2);
                // Splitter spawns children on death
                if (de.type === 'splitter') {
                    for (let s = 0; s < 3; s++) {
                        let sx = de.x + (Math.random() - 0.5) * 30;
                        let sy = de.y + (Math.random() - 0.5) * 30;
                        let tx = this.width * 0.2 + Math.random() * this.width * 0.6;
                        this.enemies.push(new SwarmEnemy(sx, sy, tx, this.height + 50, this.wave, this.planetApproach));
                    }
                    this.spawnExplosion(de.x, de.y, '#aa44ff', 45);
                }
                this.enemies.splice(i, 1);
                this.updateHud();
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }

        for (let i = this.damageTexts.length - 1; i >= 0; i--) {
            this.damageTexts[i].update(dt);
            if (this.damageTexts[i].life <= 0) this.damageTexts.splice(i, 1);
        }

        for (let i = this.explosions.length - 1; i >= 0; i--) {
            this.explosions[i].update(dt);
            if (this.explosions[i].life <= 0) this.explosions.splice(i, 1);
        }
    }

    gameOver() {
        this.isGameOver = true;
        this.isPlaying = false;
        document.getElementById('final-wave').innerText = this.wave;
        document.getElementById('game-over-screen').classList.remove('hidden');
        document.getElementById('tower-bar').classList.add('hidden');
    }

    updateHud() {
        document.getElementById('wave-count').innerText = this.wave;
        document.getElementById('credits-count').innerText = this.credits;
        document.getElementById('base-hp').innerText = Math.max(0, this.baseHp) + '%';

        const hpEl = document.getElementById('base-hp');
        if (this.baseHp < 30) hpEl.style.color = 'red';
        else hpEl.style.color = '#00f3ff';

        // Update tower affordability
        document.querySelectorAll('.tower-opt').forEach(el => {
            const cost = this.towerCosts[el.dataset.type];
            el.classList.toggle('unaffordable', this.credits < cost);
        });
    }

    draw() {
        const ctx = this.ctx;
        const W = this.width;
        const H = this.height;
        const time = Date.now();

        // Screen shake offset
        let shakeX = 0, shakeY = 0;
        if (this.screenShake > 0.1) {
            shakeX = (Math.random() - 0.5) * this.screenShake * 2;
            shakeY = (Math.random() - 0.5) * this.screenShake * 2;
        }
        ctx.save();
        ctx.translate(shakeX, shakeY);

        // Approach factor: 0 = far away, ~0.85 = dangerously close
        const approach = this.planetApproach;
        // Planet "breathing" pulse — slow, ominous
        const breathe = Math.sin(time * 0.001) * 0.01;

        // ============================================================
        // 1. SKY GRADIENT — gets warmer/redder as planet approaches
        // ============================================================
        const warmth = approach * 0.4; // 0 ~ 0.34
        const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
        skyGrad.addColorStop(0, '#020010');
        skyGrad.addColorStop(0.25, `rgb(${10 + warmth * 40}, ${5 + warmth * 5}, ${25 + warmth * 10})`);
        skyGrad.addColorStop(0.5, `rgb(${13 + warmth * 60}, ${16 + warmth * 10}, ${53 - warmth * 20})`);
        skyGrad.addColorStop(0.7, `rgb(${26 + warmth * 80}, ${21 + warmth * 10}, ${64 - warmth * 30})`);
        skyGrad.addColorStop(0.85, `rgb(${42 + warmth * 100}, ${21 + warmth * 10}, ${48 - warmth * 20})`);
        skyGrad.addColorStop(1.0, `rgb(${26 + warmth * 60}, ${10 + warmth * 5}, ${21})`);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(-10, -10, W + 20, H + 20);

        // ============================================================
        // 2. STARS — fade as planet fills the sky
        // ============================================================
        const starAlphaMult = Math.max(0.1, 1 - approach * 0.8);
        ctx.fillStyle = 'white';
        this.stars.forEach(s => {
            ctx.globalAlpha = (s.alpha + Math.sin(time * s.twinkleSpeed * 0.05) * 0.2) * starAlphaMult;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // ============================================================
        // 3. NEBULA GLOW
        // ============================================================
        const drawNebula = (nx, ny, nr, col) => {
            const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
            g.addColorStop(0, col);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
        };
        drawNebula(W * 0.3, H * 0.15, 400, `rgba(80, 20, 120, ${0.12 * starAlphaMult})`);
        drawNebula(W * 0.7, H * 0.2, 350, `rgba(20, 40, 100, ${0.1 * starAlphaMult})`);

        // ============================================================
        // 4. MASSIVE PLANET (The Looming Threat)
        //    Visible curvature, grows and descends as waves progress
        // ============================================================
        // Planet starts SMALL and far away, grows dramatically as it approaches
        const planetScale = 0.35 + approach * 2.6 + breathe;
        const cx = W / 2;
        const r = (Math.min(W, H) * 0.5) * planetScale;
        // Slightly foreshortened — looking up, wider than tall but still clearly spherical
        const rx = r * 1.15;
        const ry = r * 0.8;
        // Starts high above screen, descends into view as it approaches
        const cy = -ry * 0.7 + approach * H * 0.4;

        // Planet body — gas giant surface (elliptical from ground perspective)
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.clip();

        if (this.assets.planet) {
            // Draw zoomed-in: crop center 70% of image to fill ellipse (hides image's own sky)
            const img = this.assets.planet;
            const crop = 0.15; // crop 15% from each edge
            const sx = img.width * crop;
            const sy = img.height * crop;
            const sw = img.width * (1 - crop * 2);
            const sh = img.height * (1 - crop * 2);
            ctx.drawImage(img, sx, sy, sw, sh, cx - rx, cy - ry, rx * 2, ry * 2);

            // Edge blend — dark vignette to merge with game sky
            const edgeGrad = ctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.4, cx, cy, Math.max(rx, ry));
            edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
            edgeGrad.addColorStop(0.6, 'rgba(0,0,0,0)');
            edgeGrad.addColorStop(0.8, 'rgba(5,2,15,0.3)');
            edgeGrad.addColorStop(0.95, 'rgba(5,2,15,0.7)');
            edgeGrad.addColorStop(1, 'rgba(3,0,10,0.9)');
            ctx.fillStyle = edgeGrad;
            ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

            // === Living planet glow layers ===
            ctx.globalCompositeOperation = 'lighter';

            // 1. Main surface breathing glow — slow warm pulse (wide)
            const breath1 = 0.1 + Math.sin(time * 0.0015) * 0.04;
            const glow1 = ctx.createRadialGradient(cx, cy, ry * 0.05, cx, cy, Math.max(rx, ry) * 1.1);
            glow1.addColorStop(0, `rgba(255, 130, 70, ${breath1 + approach * 0.06})`);
            glow1.addColorStop(0.35, `rgba(220, 70, 40, ${breath1 * 0.7})`);
            glow1.addColorStop(0.7, `rgba(180, 40, 20, ${breath1 * 0.3})`);
            glow1.addColorStop(1, 'rgba(120, 20, 10, 0)');
            ctx.fillStyle = glow1;
            ctx.fillRect(cx - rx * 1.3, cy - ry * 1.3, rx * 2.6, ry * 2.6);

            // 2. Wandering magma hotspot — moves across wider surface
            const hotX = cx + Math.sin(time * 0.0003) * rx * 0.55;
            const hotY = cy + Math.cos(time * 0.0004) * ry * 0.35;
            const hotPulse = 0.12 + Math.sin(time * 0.004) * 0.05;
            const hotGrad = ctx.createRadialGradient(hotX, hotY, 0, hotX, hotY, rx * 0.55);
            hotGrad.addColorStop(0, `rgba(255, 180, 80, ${hotPulse})`);
            hotGrad.addColorStop(0.35, `rgba(255, 100, 40, ${hotPulse * 0.5})`);
            hotGrad.addColorStop(1, 'rgba(200, 40, 0, 0)');
            ctx.fillStyle = hotGrad;
            ctx.fillRect(cx - rx * 1.3, cy - ry * 1.3, rx * 2.6, ry * 2.6);

            // 3. Second hotspot — offset phase, wider
            const hot2X = cx - Math.sin(time * 0.00025) * rx * 0.5;
            const hot2Y = cy - Math.cos(time * 0.00035) * ry * 0.25 + ry * 0.2;
            const hot2Pulse = 0.09 + Math.sin(time * 0.003 + 2) * 0.04;
            const hot2Grad = ctx.createRadialGradient(hot2X, hot2Y, 0, hot2X, hot2Y, rx * 0.45);
            hot2Grad.addColorStop(0, `rgba(255, 140, 60, ${hot2Pulse})`);
            hot2Grad.addColorStop(0.45, `rgba(200, 60, 30, ${hot2Pulse * 0.4})`);
            hot2Grad.addColorStop(1, 'rgba(150, 20, 0, 0)');
            ctx.fillStyle = hot2Grad;
            ctx.fillRect(cx - rx * 1.3, cy - ry * 1.3, rx * 2.6, ry * 2.6);

            // 4. Crack-like energy veins — wider flickering bands
            for (let i = 0; i < 3; i++) {
                const veinY = cy + (i - 1) * ry * 0.4 + Math.sin(time * 0.001 + i * 2) * ry * 0.08;
                const veinFlicker = 0.04 + Math.sin(time * 0.006 + i * 1.5) * 0.025;
                const veinGrad = ctx.createRadialGradient(cx, veinY, 0, cx, veinY, rx * 1.0);
                veinGrad.addColorStop(0, `rgba(255, 160, 80, ${veinFlicker})`);
                veinGrad.addColorStop(0.25, `rgba(255, 80, 30, ${veinFlicker * 0.5})`);
                veinGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = veinGrad;
                ctx.beginPath();
                ctx.ellipse(cx, veinY, rx * 1.0, ry * 0.07, Math.sin(time * 0.0002 + i) * 0.15, 0, Math.PI * 2);
                ctx.fill();
            }

            // 5. Bottom atmospheric burn — wider warm entry glow
            const burnPulse = 0.18 + approach * 0.12 + Math.sin(time * 0.003) * 0.05;
            const burnGlow = ctx.createRadialGradient(cx, cy + ry * 0.85, ry * 0.05, cx, cy + ry * 0.2, rx * 1.1);
            burnGlow.addColorStop(0, `rgba(255, 160, 60, ${burnPulse})`);
            burnGlow.addColorStop(0.35, `rgba(255, 90, 20, ${burnPulse * 0.5})`);
            burnGlow.addColorStop(1, 'rgba(200, 30, 0, 0)');
            ctx.fillStyle = burnGlow;
            ctx.fillRect(cx - rx * 1.3, cy - ry * 0.2, rx * 2.6, ry * 1.5);

            ctx.globalCompositeOperation = 'source-over';
        }

        // Base gradient — fallback for no texture
        if (!this.assets.planet) {
            const planetGrad = ctx.createRadialGradient(cx, cy + ry * 0.15, ry * 0.1, cx, cy, Math.max(rx, ry));
            planetGrad.addColorStop(0, '#251040');
            planetGrad.addColorStop(0.25, '#1a0830');
            planetGrad.addColorStop(0.5, '#120520');
            planetGrad.addColorStop(0.8, '#080215');
            planetGrad.addColorStop(1, '#03000a');
            ctx.fillStyle = planetGrad;
            ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
        }

        // Atmospheric banding — skip if texture loaded
        if (!this.assets.planet) {
        // Atmospheric banding — bold, high contrast, gas giant stripes
        const bandCount = 22;
        const bandAlpha = 1.5 + approach * 1.5;
        // Alternating dark/light band pairs for clear stripe pattern
        const bandColors = [
            [160, 60, 180], [40, 20, 60],  [180, 80, 110], [30, 25, 70],
            [140, 45, 90],  [50, 35, 100], [170, 90, 130], [35, 20, 55],
            [120, 40, 70],  [60, 45, 120], [150, 65, 100], [25, 15, 50]
        ];
        for (let i = 0; i < bandCount; i++) {
            const t = i / bandCount;
            const perspT = 0.5 + (t - 0.5) * (0.7 + (t > 0.5 ? 0.6 : 0.3) * Math.abs(t - 0.5));
            const yOff = (perspT * 2 - 1) * ry;
            const normY = (perspT * 2 - 1);
            const bandW = rx * Math.sqrt(Math.max(0, 1 - normY * normY));
            if (bandW <= 0) continue;
            const bandH = ry * 2 / bandCount;
            const c = bandColors[i % bandColors.length];
            const waveOff = Math.sin(t * 10 + time * 0.0003) * rx * 0.02;

            // Main band — bold alpha
            const alpha = (0.15 + Math.sin(t * 6) * 0.06) * bandAlpha;
            ctx.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
            ctx.beginPath();
            ctx.ellipse(cx + waveOff, cy + yOff, bandW, bandH * 2.2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Bright edge highlight every few bands
            if (i % 2 === 0) {
                ctx.fillStyle = `rgba(${Math.min(255, c[0] + 80)}, ${Math.min(255, c[1] + 50)}, ${Math.min(255, c[2] + 50)}, ${alpha * 0.35})`;
                ctx.beginPath();
                ctx.ellipse(cx - waveOff * 0.5, cy + yOff + bandH * 0.4, bandW * 0.97, bandH * 0.35, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Turbulent cloud wisps between bands
        for (let i = 0; i < 8; i++) {
            const wy = cy + (i / 8 - 0.5) * ry * 1.6;
            const wx = cx + Math.sin(i * 3.7 + time * 0.0002) * rx * 0.3;
            const wispGrad = ctx.createRadialGradient(wx, wy, 0, wx, wy, rx * 0.15);
            wispGrad.addColorStop(0, `rgba(180, 100, 160, ${0.06 + approach * 0.03})`);
            wispGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = wispGrad;
            ctx.beginPath();
            ctx.ellipse(wx, wy, rx * 0.15, ry * 0.04, Math.sin(i + time * 0.0001) * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Great storm eye — positioned on the visible underside
        const stormX = cx + Math.sin(time * 0.00015) * rx * 0.2;
        const stormY = cy + ry * 0.25;
        const stormSx = rx * 0.15;
        const stormSy = ry * 0.12;
        const stormGrad = ctx.createRadialGradient(stormX, stormY, 0, stormX, stormY, stormSx);
        stormGrad.addColorStop(0, `rgba(200, 60, 80, ${0.3 + approach * 0.15})`);
        stormGrad.addColorStop(0.4, `rgba(160, 40, 100, ${0.2 + approach * 0.1})`);
        stormGrad.addColorStop(0.7, `rgba(120, 30, 80, ${0.1})`);
        stormGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = stormGrad;
        ctx.beginPath();
        ctx.ellipse(stormX, stormY, stormSx, stormSy, Math.sin(time * 0.0002) * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(220, 80, 100, ${0.15 + approach * 0.1})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(stormX, stormY, stormSx * 0.7, stormSy * 0.7, -Math.sin(time * 0.0003) * 0.4, 0, Math.PI * 2);
        ctx.stroke();

        // Second smaller storm
        const storm2X = cx - rx * 0.25 + Math.sin(time * 0.0002) * rx * 0.04;
        const storm2Y = cy + ry * 0.1;
        const s2Grad = ctx.createRadialGradient(storm2X, storm2Y, 0, storm2X, storm2Y, rx * 0.08);
        s2Grad.addColorStop(0, `rgba(80, 50, 160, ${0.2 + approach * 0.1})`);
        s2Grad.addColorStop(0.6, `rgba(50, 30, 120, ${0.1})`);
        s2Grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = s2Grad;
        ctx.beginPath();
        ctx.ellipse(storm2X, storm2Y, rx * 0.08, ry * 0.06, 0.3, 0, Math.PI * 2);
        ctx.fill();
        } // end procedural planet surface

        // Spherical shading — left/right terminator
        const shadeGrad = ctx.createLinearGradient(cx - rx, cy, cx + rx, cy);
        shadeGrad.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
        shadeGrad.addColorStop(0.3, 'rgba(0, 0, 0, 0.1)');
        shadeGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
        shadeGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.15)');
        shadeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
        ctx.fillStyle = shadeGrad;
        ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

        // Edge darkening for curved surface depth
        const curveGrad = ctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.3, cx, cy, rx);
        curveGrad.addColorStop(0, 'rgba(0,0,0,0)');
        curveGrad.addColorStop(0.7, 'rgba(0,0,0,0.05)');
        curveGrad.addColorStop(0.9, 'rgba(0,0,0,0.2)');
        curveGrad.addColorStop(1, 'rgba(0,0,0,0.45)');
        ctx.fillStyle = curveGrad;
        ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

        // BURNING ATMOSPHERE — concentrated at the rim, not covering the whole surface
        ctx.globalCompositeOperation = 'lighter';
        const heatBase = 0.1 + approach * 0.2;
        const heatPulse = heatBase + Math.sin(time * 0.003) * 0.05;

        // Primary burn at bottom edge (underside visible from ground)
        const burnGrad = ctx.createRadialGradient(cx, cy + ry * 0.8, ry * 0.05, cx, cy + ry * 0.3, rx * 0.6);
        burnGrad.addColorStop(0, `rgba(255, 130, 30, ${heatPulse})`);
        burnGrad.addColorStop(0.4, `rgba(255, 70, 10, ${heatPulse * 0.6})`);
        burnGrad.addColorStop(1, 'rgba(200, 30, 0, 0)');
        ctx.fillStyle = burnGrad;
        ctx.fillRect(cx - rx, cy, rx * 2, ry);

        // Secondary burn — wide glow
        const burnGrad2 = ctx.createRadialGradient(cx, cy + ry * 0.95, ry * 0.05, cx, cy + ry * 0.5, rx * 0.5);
        burnGrad2.addColorStop(0, `rgba(255, 220, 80, ${heatPulse * 0.7})`);
        burnGrad2.addColorStop(1, 'rgba(255, 80, 0, 0)');
        ctx.fillStyle = burnGrad2;
        ctx.fillRect(cx - rx, cy, rx * 2, ry);

        // Spawn flash — planet pulses bright when launching enemies
        if (this.spawnFlash > 0.05) {
            const flashGrad = ctx.createRadialGradient(cx, cy + ry * 0.9, 0, cx, cy + ry * 0.4, rx * 0.4);
            flashGrad.addColorStop(0, `rgba(255, 255, 200, ${this.spawnFlash * 0.6})`);
            flashGrad.addColorStop(0.5, `rgba(255, 150, 50, ${this.spawnFlash * 0.35})`);
            flashGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');
            ctx.fillStyle = flashGrad;
            ctx.fillRect(cx - rx, cy, rx * 2, ry);
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();

        // Rim Light — subtle glow at planet edge
        ctx.save();
        const rimIntensity = 0.15 + approach * 0.2;
        ctx.shadowBlur = 30 + approach * 50;
        ctx.shadowColor = approach > 0.5 ? '#ff220088' : '#ff660066';
        ctx.strokeStyle = `rgba(255, ${Math.floor(180 - approach * 100)}, 40, ${rimIntensity + Math.sin(time * 0.004) * 0.05})`;
        ctx.lineWidth = 1.5 + approach * 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, Math.PI * 0.05, Math.PI * 0.95);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();

        // Atmospheric scatter — orange haze below planet
        const atmosSpread = 200 + approach * 250;
        const atmosIntensity = 0.06 + approach * 0.14;
        const atmosGrad = ctx.createLinearGradient(0, cy + ry - atmosSpread, 0, cy + ry + 250);
        atmosGrad.addColorStop(0, 'rgba(0,0,0,0)');
        atmosGrad.addColorStop(0.25, `rgba(255, 80, 20, ${atmosIntensity + Math.sin(time * 0.002) * 0.02})`);
        atmosGrad.addColorStop(0.5, `rgba(255, 120, 40, ${atmosIntensity * 0.8})`);
        atmosGrad.addColorStop(0.75, `rgba(200, 60, 20, ${atmosIntensity * 0.3})`);
        atmosGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = atmosGrad;
        ctx.fillRect(0, cy + ry - atmosSpread, W, atmosSpread + 250);

        // ============================================================
        // 5. FALLING DEBRIS (shooting stars in the atmosphere)
        // ============================================================
        this.debris.forEach(d => {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const dx = Math.cos(d.angle);
            const dy = Math.sin(d.angle);
            const b = d.brightness || 1;

            // Outer wide glow trail
            const glowGrad = ctx.createLinearGradient(
                d.x, d.y,
                d.x - dx * d.trailLen * 1.2, d.y - dy * d.trailLen * 1.2
            );
            glowGrad.addColorStop(0, `rgba(255, 180, 80, ${0.5 * b})`);
            glowGrad.addColorStop(0.4, `rgba(255, 80, 20, ${0.15 * b})`);
            glowGrad.addColorStop(1, 'rgba(200, 30, 0, 0)');
            ctx.strokeStyle = glowGrad;
            ctx.lineWidth = d.size * 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - dx * d.trailLen * 1.2, d.y - dy * d.trailLen * 1.2);
            ctx.stroke();

            // Inner bright core trail
            const coreGrad = ctx.createLinearGradient(
                d.x, d.y,
                d.x - dx * d.trailLen, d.y - dy * d.trailLen
            );
            coreGrad.addColorStop(0, `rgba(255, 255, 230, ${0.9 * b})`);
            coreGrad.addColorStop(0.3, `rgba(255, 200, 100, ${0.5 * b})`);
            coreGrad.addColorStop(1, 'rgba(255, 80, 0, 0)');
            ctx.strokeStyle = coreGrad;
            ctx.lineWidth = d.size;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - dx * d.trailLen, d.y - dy * d.trailLen);
            ctx.stroke();

            // Bright head with flare
            let headGrad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.size * 3);
            headGrad.addColorStop(0, `rgba(255, 255, 255, ${b})`);
            headGrad.addColorStop(0.4, `rgba(255, 200, 100, ${0.5 * b})`);
            headGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
            ctx.fillStyle = headGrad;
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.size * 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalCompositeOperation = 'source-over';
            ctx.restore();
        });

        // ============================================================
        // 6. CLOUDS (atmospheric depth between planet and city)
        // ============================================================
        this.clouds.forEach(c => {
            const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.w / 2);
            // Warm-tinted clouds (lit from above by planet glow)
            g.addColorStop(0, `rgba(40, 25, 50, ${c.opacity * 1.5})`);
            g.addColorStop(0.5, `rgba(20, 15, 30, ${c.opacity})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h);
        });

        // ============================================================
        // 7. CAPITAL SHIPS
        // ============================================================
        this.capitalShips.forEach(s => s.draw(ctx));

        // ============================================================
        // 8. CITY LAYERS (Extreme Fish-Eye Perspective)
        //    Buildings lean dramatically inward, framing the sky
        // ============================================================
        this.cityLayers.forEach((layer, idx) => {
            layer.buildings.forEach(b => {
                ctx.save();
                ctx.translate(b.x + b.w / 2, b.y);
                ctx.rotate(b.angle);

                // Building body - gradient for depth
                const bGrad = ctx.createLinearGradient(0, 0, 0, b.h);
                bGrad.addColorStop(0, layer.color);
                bGrad.addColorStop(1, '#000');
                ctx.fillStyle = bGrad;
                ctx.fillRect(-b.w / 2, 0, b.w, b.h);

                // Edge highlight (rim light from planet glow)
                if (idx >= 1) {
                    ctx.strokeStyle = `rgba(255, 100, 40, ${0.05 + idx * 0.03})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    if (b.x < W / 2) {
                        ctx.moveTo(b.w / 2, 0);
                        ctx.lineTo(b.w / 2, b.h);
                    } else {
                        ctx.moveTo(-b.w / 2, 0);
                        ctx.lineTo(-b.w / 2, b.h);
                    }
                    ctx.stroke();
                }

                // Spire/antenna
                if (b.spireH > 0 && idx >= 1) {
                    ctx.strokeStyle = `rgba(100, 150, 200, ${0.2 + idx * 0.1})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(0, b.h);
                    ctx.lineTo(0, b.h - b.spireH);
                    ctx.stroke();
                    // Blinking light on top
                    if (Math.sin(time * 0.003 + b.x) > 0.5) {
                        ctx.fillStyle = '#ff0033';
                        ctx.beginPath();
                        ctx.arc(0, b.h - b.spireH, 1.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                // Windows
                if (idx > 0 && b.windows) {
                    b.windows.forEach(w => {
                        if (Math.abs(w.ry) < Math.abs(b.h) - 5) {
                            let wColor;
                            if (w.bright > 0.95) {
                                wColor = '#ff0055';
                            } else if (w.bright > 0.8) {
                                wColor = `rgba(255, 200, 100, ${0.4 + idx * 0.15})`;
                            } else {
                                wColor = `rgba(80, 180, 255, ${0.2 + idx * 0.2})`;
                            }
                            ctx.fillStyle = wColor;
                            ctx.fillRect(-b.w / 2 + w.rx, -w.ry, 2, 3);
                        }
                    });
                }

                ctx.restore();
            });

            // After the foreground layer, add a warm glow at the city base
            if (idx === 2) {
                const cityGlow = ctx.createLinearGradient(0, H, 0, H - 200);
                cityGlow.addColorStop(0, 'rgba(255, 80, 30, 0.08)');
                cityGlow.addColorStop(0.5, 'rgba(255, 50, 20, 0.03)');
                cityGlow.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = cityGlow;
                ctx.fillRect(0, H - 200, W, 200);
            }
        });

        // ============================================================
        // 9. GAMEPLAY LAYER
        // ============================================================
        ctx.save();
        this.projectiles.forEach(p => p.draw(ctx));
        ctx.restore();

        this.enemies.forEach(e => e.draw(ctx));
        this.towers.forEach(t => t.draw(ctx));
        this.explosions.forEach(ex => ex.draw(ctx));
        this.particles.forEach(p => p.draw(ctx));
        this.damageTexts.forEach(dt => dt.draw(ctx));

        // ============================================================
        // 10. POST-PROCESSING: Vignette + Shield Line
        // ============================================================
        // Vignette (stronger at edges to emphasize the canyon feel)
        const vig = ctx.createRadialGradient(W / 2, H * 0.4, H * 0.3, W / 2, H * 0.4, H * 1.2);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.7)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);

        // Shield line (defense boundary)
        ctx.strokeStyle = `rgba(0, 243, 255, ${this.baseHp / 200})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, H - 50);
        ctx.quadraticCurveTo(W / 2, H - 150, W, H - 50);
        ctx.stroke();

        // End screen shake transform
        ctx.restore();

        // Danger overlay — red tint at edges when planet is very close
        if (approach > 0.4) {
            const dangerAlpha = (approach - 0.4) * 0.15;
            ctx.fillStyle = `rgba(255, 0, 0, ${dangerAlpha})`;
            ctx.fillRect(0, 0, W, H * 0.1);
            ctx.fillRect(0, H * 0.9, W, H * 0.1);
        }
    }

    loop(t) {
        let dt = t - this.lastTime;
        this.lastTime = t;
        this.update(dt);
        this.draw();
        requestAnimationFrame((time) => this.loop(time));
    }
}

// ================= ENTITY CLASSES =================

class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class Enemy extends Entity {
    constructor(x, y, targetX, targetY, difficultyMultiplier, planetApproach = 0) {
        super(x, y);
        this.targetX = targetX;
        this.targetY = targetY;
        // Speed scales with wave AND planet proximity — closer planet = faster meteors
        const approachSpeedBoost = planetApproach * 0.04;
        this.speed = 0.08 + (difficultyMultiplier * 0.015) + approachSpeedBoost;
        this.hp = 20 + (difficultyMultiplier * 10);
        this.maxHp = this.hp;
        this.size = 12;
        this.color = '#ff0055';
        this.reward = 15;
        this.angle = Math.atan2(targetY - y, targetX - x);
        // Long trail for shooting star / comet effect
        this.trail = [];
        this.trailMax = 35;
        // Sparks that fly off the trail
        this.sparks = [];
        // Slow effect (applied by shield generators each frame)
        this.slowFactor = 1;
        this.type = 'standard';
        this.headScale = 1.0;
    }

    update(dt) {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.trailMax) this.trail.shift();

        const effectiveSpeed = this.speed * this.slowFactor;
        this.slowFactor = 1; // Reset — shields re-apply each frame

        this.x += Math.cos(this.angle) * effectiveSpeed * dt;
        this.y += Math.sin(this.angle) * effectiveSpeed * dt;
        this.x += Math.sin(this.y * 0.05) * 0.5;

        // Spawn sparks that break off from the trail — more frequent, more variety
        if (Math.random() > 0.4 && this.trail.length > 3) {
            let src = this.trail[this.trail.length - Math.floor(Math.random() * 3) - 1];
            this.sparks.push({
                x: src.x + (Math.random() - 0.5) * 8,
                y: src.y + (Math.random() - 0.5) * 8,
                vx: (Math.random() - 0.5) * 0.2,
                vy: (Math.random() - 0.5) * 0.15 + 0.06,
                life: 200 + Math.random() * 300,
                maxLife: 500,
                size: 0.5 + Math.random() * 2.5
            });
        }
        // Extra ember particles
        if (Math.random() > 0.7) {
            this.sparks.push({
                x: this.x + (Math.random() - 0.5) * 10,
                y: this.y + (Math.random() - 0.5) * 10,
                vx: (Math.random() - 0.5) * 0.3,
                vy: Math.random() * 0.1 + 0.02,
                life: 100 + Math.random() * 150,
                maxLife: 250,
                size: 0.3 + Math.random() * 1
            });
        }
        // Update sparks
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            let s = this.sparks[i];
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.life -= dt;
            if (s.life <= 0) this.sparks.splice(i, 1);
        }
    }

    draw(ctx) {
        const len = this.trail.length;
        if (len < 2) return;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // 1. Ultra-wide ambient glow trail
        for (let i = 1; i < len; i++) {
            let t0 = this.trail[i - 1];
            let t1 = this.trail[i];
            let ratio = i / len;
            let width = ratio < 0.85 ? ratio * 24 : (1 - (ratio - 0.85) / 0.15) * 24;
            ctx.strokeStyle = `rgba(255, ${Math.floor(30 + ratio * 60)}, 0, ${ratio * 0.15})`;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(t0.x, t0.y);
            ctx.lineTo(t1.x, t1.y);
            ctx.stroke();
        }

        // 2. Outer glow trail (wide, orange-red)
        for (let i = 1; i < len; i++) {
            let t0 = this.trail[i - 1];
            let t1 = this.trail[i];
            let ratio = i / len;
            let width = ratio < 0.85 ? ratio * 14 : (1 - (ratio - 0.85) / 0.15) * 14;
            ctx.strokeStyle = `rgba(255, ${Math.floor(50 + ratio * 140)}, ${Math.floor(ratio * 30)}, ${ratio * 0.45})`;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(t0.x, t0.y);
            ctx.lineTo(t1.x, t1.y);
            ctx.stroke();
        }

        // 3. Inner core trail (narrow, white-hot)
        for (let i = 1; i < len; i++) {
            let t0 = this.trail[i - 1];
            let t1 = this.trail[i];
            let ratio = i / len;
            let width = ratio < 0.85 ? ratio * 6 : (1 - (ratio - 0.85) / 0.15) * 6;
            ctx.strokeStyle = `rgba(255, 255, ${Math.floor(200 + ratio * 55)}, ${ratio * 0.85})`;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(t0.x, t0.y);
            ctx.lineTo(t1.x, t1.y);
            ctx.stroke();
        }

        // 4. Sparks breaking off - with glow
        this.sparks.forEach(s => {
            let a = s.life / s.maxLife;
            let sz = s.size * a;
            if (sz < 0.1) return;
            // Soft glow halo
            let sparkGrad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, sz * 4);
            sparkGrad.addColorStop(0, `rgba(255, ${180 + Math.floor(Math.random() * 75)}, 50, ${a * 0.5})`);
            sparkGrad.addColorStop(1, 'rgba(255, 80, 0, 0)');
            ctx.fillStyle = sparkGrad;
            ctx.beginPath();
            ctx.arc(s.x, s.y, sz * 4, 0, Math.PI * 2);
            ctx.fill();
            // Bright core
            ctx.fillStyle = `rgba(255, 255, ${200 + Math.floor(Math.random() * 55)}, ${a * 0.9})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, sz * 0.6, 0, Math.PI * 2);
            ctx.fill();
        });

        // 5. Meteor HEAD — scaled by headScale, colored by type
        const hs = this.headScale;
        ctx.shadowBlur = 40 * hs;
        ctx.shadowColor = '#ffaa00';

        // Ultra-wide ambient halo
        let ambientGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 35 * hs);
        ambientGrad.addColorStop(0, 'rgba(255, 200, 80, 0.4)');
        ambientGrad.addColorStop(0.5, 'rgba(255, 100, 20, 0.1)');
        ambientGrad.addColorStop(1, 'rgba(255, 40, 0, 0)');
        ctx.fillStyle = ambientGrad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 35 * hs, 0, Math.PI * 2);
        ctx.fill();

        // Main halo
        let headGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 22 * hs);
        headGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        headGrad.addColorStop(0.15, 'rgba(255, 240, 180, 0.85)');
        headGrad.addColorStop(0.4, 'rgba(255, 150, 50, 0.35)');
        headGrad.addColorStop(0.7, 'rgba(255, 80, 10, 0.12)');
        headGrad.addColorStop(1, 'rgba(255, 40, 0, 0)');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 22 * hs, 0, Math.PI * 2);
        ctx.fill();

        // White-hot core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5 * hs, 0, Math.PI * 2);
        ctx.fill();

        // Type-specific head overlay
        if (this.type === 'tank') {
            let tankGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2);
            tankGrad.addColorStop(0, 'rgba(255, 30, 30, 0.5)');
            tankGrad.addColorStop(0.5, 'rgba(200, 0, 0, 0.15)');
            tankGrad.addColorStop(1, 'rgba(150, 0, 0, 0)');
            ctx.fillStyle = tankGrad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
            ctx.fill();
            // Rocky ring
            ctx.strokeStyle = 'rgba(255, 100, 50, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 1.2, 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.type === 'swarm') {
            let swarmGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2);
            swarmGrad.addColorStop(0, 'rgba(0, 255, 150, 0.35)');
            swarmGrad.addColorStop(1, 'rgba(0, 200, 100, 0)');
            ctx.fillStyle = swarmGrad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'splitter') {
            let pulseAlpha = 0.3 + Math.sin(Date.now() * 0.008) * 0.15;
            let splitGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2.5);
            splitGrad.addColorStop(0, `rgba(180, 50, 255, ${pulseAlpha})`);
            splitGrad.addColorStop(0.6, `rgba(120, 20, 200, ${pulseAlpha * 0.4})`);
            splitGrad.addColorStop(1, 'rgba(80, 0, 150, 0)');
            ctx.fillStyle = splitGrad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 2.5, 0, Math.PI * 2);
            ctx.fill();
            // Unstable ring pulse
            ctx.strokeStyle = `rgba(200, 100, 255, ${pulseAlpha * 0.6})`;
            ctx.lineWidth = 1;
            let ringR = this.size * (1.3 + Math.sin(Date.now() * 0.006) * 0.3);
            ctx.beginPath();
            ctx.arc(this.x, this.y, ringR, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';

        // 5. HP bar (only when damaged)
        if (this.hp < this.maxHp) {
            let barW = 24;
            let hpRatio = this.hp / this.maxHp;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x - barW / 2, this.y - 24, barW, 3);
            ctx.fillStyle = hpRatio > 0.5 ? '#00ff88' : '#ff3300';
            ctx.fillRect(this.x - barW / 2, this.y - 24, barW * hpRatio, 3);
        }

        ctx.restore();
    }
}

class TankEnemy extends Enemy {
    constructor(x, y, targetX, targetY, wave, planetApproach) {
        super(x, y, targetX, targetY, wave, planetApproach);
        this.hp = 60 + wave * 25;
        this.maxHp = this.hp;
        this.speed *= 0.4;
        this.size = 22;
        this.reward = 35;
        this.trailMax = 25;
        this.type = 'tank';
        this.headScale = 1.6;
    }
}

class SwarmEnemy extends Enemy {
    constructor(x, y, targetX, targetY, wave, planetApproach) {
        super(x, y, targetX, targetY, wave, planetApproach);
        this.hp = 6 + wave * 3;
        this.maxHp = this.hp;
        this.speed *= 1.9;
        this.size = 7;
        this.reward = 5;
        this.trailMax = 18;
        this.type = 'swarm';
        this.headScale = 0.5;
    }
}

class SplitterEnemy extends Enemy {
    constructor(x, y, targetX, targetY, wave, planetApproach) {
        super(x, y, targetX, targetY, wave, planetApproach);
        this.hp = 35 + wave * 15;
        this.maxHp = this.hp;
        this.speed *= 0.7;
        this.size = 17;
        this.reward = 20;
        this.type = 'splitter';
        this.headScale = 1.2;
    }
}

class CapitalShip extends Entity {
    constructor(w, h) {
        let fromLeft = Math.random() > 0.5;
        super(fromLeft ? -300 : w + 300, h * 0.1 + Math.random() * h * 0.3);

        this.vx = fromLeft ? 0.01 + Math.random() * 0.015 : -(0.01 + Math.random() * 0.015);
        this.width = 300 + Math.random() * 200;
        this.height = 60 + Math.random() * 40;
    }

    update(dt) {
        this.x += this.vx * dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.vx < 0) ctx.scale(-1, 1);

        // Engine trails
        ctx.globalCompositeOperation = 'lighter';
        const trailGrad = ctx.createLinearGradient(-this.width, 0, -this.width - 150, 0);
        trailGrad.addColorStop(0, 'rgba(0, 200, 255, 0.7)');
        trailGrad.addColorStop(0.5, 'rgba(0, 100, 255, 0.3)');
        trailGrad.addColorStop(1, 'rgba(0, 50, 200, 0)');
        ctx.fillStyle = trailGrad;
        ctx.fillRect(-this.width, -15, 150, 30);

        // Secondary engine
        ctx.fillRect(-this.width + 20, -25, 80, 10);
        ctx.fillRect(-this.width + 20, 15, 80, 10);
        ctx.globalCompositeOperation = 'source-over';

        // Ship body
        ctx.fillStyle = '#101020';
        ctx.strokeStyle = '#252545';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-this.width * 0.3, -this.height / 2);
        ctx.lineTo(-this.width, -this.height / 3);
        ctx.lineTo(-this.width, this.height / 3);
        ctx.lineTo(-this.width * 0.3, this.height / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Top rim light (definition against dark sky)
        ctx.strokeStyle = 'rgba(100, 130, 200, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-this.width * 0.3, -this.height / 2);
        ctx.lineTo(-this.width, -this.height / 3);
        ctx.stroke();

        // Bottom warm light (reflected from planet/atmosphere)
        ctx.strokeStyle = 'rgba(255, 100, 50, 0.2)';
        ctx.beginPath();
        ctx.moveTo(-this.width * 0.3, this.height / 2);
        ctx.lineTo(-this.width, this.height / 3);
        ctx.stroke();

        // Window lights
        for (let i = 0; i < 12; i++) {
            if (Math.random() > 0.85) {
                ctx.fillStyle = Math.random() > 0.5 ? '#ff0055' : '#00aaff';
                ctx.fillRect(
                    -this.width * 0.1 - Math.random() * this.width * 0.8,
                    (Math.random() - 0.5) * this.height * 0.4,
                    3, 3
                );
            }
        }

        ctx.restore();
    }
}

class Tower extends Entity {
    constructor(x, y) {
        super(x, y);
        this.range = 450;
        this.damage = 15;
        this.fireRate = 400;
        this.cooldown = 0;
        this.color = '#00f3ff';
        this.target = null;
        this.aimAngle = 0;
        this.flashTimer = 0; // Muzzle flash
    }

    update(dt, enemies, game) {
        this.cooldown -= dt;
        this.flashTimer -= dt;

        this.target = null;
        let minDist = this.range;
        for (let e of enemies) {
            let dist = Math.hypot(e.x - this.x, e.y - this.y);
            if (dist < this.range && dist < minDist) {
                minDist = dist;
                this.target = e;
            }
        }

        if (this.target) {
            // Smooth aim toward target
            let desired = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            let diff = desired - this.aimAngle;
            // Normalize angle
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.aimAngle += diff * 0.15;
        }

        if (this.target && this.cooldown <= 0) {
            this.shoot(game);
            this.cooldown = this.fireRate;
            this.flashTimer = 80;
        }
    }

    shoot(game) {
        game.projectiles.push(new Projectile(this.x, this.y, this.target, this.damage));
    }

    draw(ctx) {
        const time = Date.now();

        // Ground tether beam (energy column from base)
        const tGrad = ctx.createLinearGradient(this.x, this.y + 10, this.x, ctx.canvas.height);
        tGrad.addColorStop(0, 'rgba(0, 243, 255, 0.15)');
        tGrad.addColorStop(1, 'rgba(0, 100, 200, 0)');
        ctx.strokeStyle = tGrad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + 12);
        ctx.lineTo(this.x, ctx.canvas.height);
        ctx.stroke();

        ctx.save();
        ctx.translate(this.x, this.y);

        // Range indicator (subtle pulse when targeting)
        if (this.target) {
            ctx.strokeStyle = `rgba(0, 243, 255, ${0.03 + Math.sin(time * 0.005) * 0.01})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, this.range, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Hexagonal base platform
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.fillStyle = '#080818';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            let a = (Math.PI / 3) * i - Math.PI / 6;
            let px = Math.cos(a) * 10;
            let py = Math.sin(a) * 10;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Turret barrel (points at target)
        ctx.save();
        ctx.rotate(this.aimAngle);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(16, 0);
        ctx.stroke();

        // Barrel glow
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(4, -2);
        ctx.lineTo(16, -2);
        ctx.moveTo(4, 2);
        ctx.lineTo(16, 2);
        ctx.stroke();

        // Muzzle flash
        if (this.flashTimer > 0) {
            ctx.globalCompositeOperation = 'lighter';
            let flashAlpha = this.flashTimer / 80;
            let flashGrad = ctx.createRadialGradient(16, 0, 0, 16, 0, 12);
            flashGrad.addColorStop(0, `rgba(200, 255, 255, ${flashAlpha})`);
            flashGrad.addColorStop(1, 'rgba(0, 150, 255, 0)');
            ctx.fillStyle = flashGrad;
            ctx.beginPath();
            ctx.arc(16, 0, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();

        // Center energy core (rotating)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        // Spinning ring around core
        ctx.strokeStyle = `rgba(0, 243, 255, 0.4)`;
        ctx.lineWidth = 1;
        let spinAngle = time * 0.004;
        ctx.beginPath();
        ctx.arc(0, 0, 6, spinAngle, spinAngle + Math.PI * 1.2);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

class LaserTower extends Entity {
    constructor(x, y) {
        super(x, y);
        this.range = 500;
        this.dps = 35;
        this.color = '#ff3366';
        this.target = null;
        this.aimAngle = 0;
        this.beamIntensity = 0;
        this.beamFlicker = 0;
        this.dmgTextTimer = 0;
        this.dmgAccum = 0;
    }

    update(dt, enemies, game) {
        this.target = null;
        let minDist = this.range;
        for (let e of enemies) {
            if (e.hp <= 0) continue;
            let dist = Math.hypot(e.x - this.x, e.y - this.y);
            if (dist < this.range && dist < minDist) {
                minDist = dist;
                this.target = e;
            }
        }

        if (this.target) {
            let desired = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            let diff = desired - this.aimAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.aimAngle += diff * 0.15;

            // Beam ramps up when locked on
            this.beamIntensity = Math.min(1, this.beamIntensity + dt * 0.003);
            this.beamFlicker = 0.85 + Math.random() * 0.15;

            // Continuous damage
            const laserDmg = this.dps * (dt / 1000) * this.beamIntensity;
            this.target.hp -= laserDmg;
            this.dmgAccum += laserDmg;
            this.dmgTextTimer -= dt;
            if (this.dmgTextTimer <= 0 && this.dmgAccum > 0) {
                game.spawnDamageText(this.target.x, this.target.y - 15, Math.round(this.dmgAccum), '#ff6688');
                game.spawnParticles(this.target.x, this.target.y, 2, '#ff3366');
                this.dmgAccum = 0;
                this.dmgTextTimer = 220;
            }
        } else {
            this.beamIntensity *= 0.9;
        }
    }

    draw(ctx) {
        const time = Date.now();

        // Draw beam to target
        if (this.target && this.beamIntensity > 0.05) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const intensity = this.beamIntensity * this.beamFlicker;
            const tx = this.target.x;
            const ty = this.target.y;

            // Layer 1: Ultra-wide soft glow
            ctx.strokeStyle = `rgba(255, 30, 60, ${intensity * 0.12})`;
            ctx.lineWidth = 22 * intensity;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(tx, ty);
            ctx.stroke();

            // Layer 2: Wide glow beam
            ctx.strokeStyle = `rgba(255, 50, 100, ${intensity * 0.3})`;
            ctx.lineWidth = 12 * intensity;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(tx, ty);
            ctx.stroke();

            // Layer 3: Mid beam
            ctx.strokeStyle = `rgba(255, 140, 180, ${intensity * 0.55})`;
            ctx.lineWidth = 5 * intensity;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(tx, ty);
            ctx.stroke();

            // Layer 4: Core beam (white-hot)
            ctx.strokeStyle = `rgba(255, 230, 245, ${intensity * 0.9})`;
            ctx.lineWidth = 2 * intensity;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(tx, ty);
            ctx.stroke();

            // Hit point glow - larger, brighter
            let hitGrad = ctx.createRadialGradient(tx, ty, 0, tx, ty, 30);
            hitGrad.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.7})`);
            hitGrad.addColorStop(0.2, `rgba(255, 200, 220, ${intensity * 0.5})`);
            hitGrad.addColorStop(0.5, `rgba(255, 80, 130, ${intensity * 0.25})`);
            hitGrad.addColorStop(1, 'rgba(255, 50, 100, 0)');
            ctx.fillStyle = hitGrad;
            ctx.beginPath();
            ctx.arc(tx, ty, 30, 0, Math.PI * 2);
            ctx.fill();

            // Origin glow at tower
            let originGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 15);
            originGrad.addColorStop(0, `rgba(255, 200, 220, ${intensity * 0.5})`);
            originGrad.addColorStop(1, 'rgba(255, 50, 100, 0)');
            ctx.fillStyle = originGrad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 15, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalCompositeOperation = 'source-over';
            ctx.restore();
        }

        // Ground tether
        const tGrad = ctx.createLinearGradient(this.x, this.y + 10, this.x, ctx.canvas.height);
        tGrad.addColorStop(0, 'rgba(255, 50, 100, 0.12)');
        tGrad.addColorStop(1, 'rgba(255, 20, 60, 0)');
        ctx.strokeStyle = tGrad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + 12);
        ctx.lineTo(this.x, ctx.canvas.height);
        ctx.stroke();

        ctx.save();
        ctx.translate(this.x, this.y);

        // Diamond base
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.fillStyle = '#180810';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(9, 0);
        ctx.lineTo(0, 11);
        ctx.lineTo(-9, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Turret barrel
        ctx.save();
        ctx.rotate(this.aimAngle);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(5, -1);
        ctx.lineTo(18, -1);
        ctx.moveTo(5, 1);
        ctx.lineTo(18, 1);
        ctx.stroke();

        // Barrel tip glow
        if (this.beamIntensity > 0.3) {
            ctx.globalCompositeOperation = 'lighter';
            let tipGrad = ctx.createRadialGradient(18, 0, 0, 18, 0, 6);
            tipGrad.addColorStop(0, `rgba(255, 150, 180, ${this.beamIntensity * 0.7})`);
            tipGrad.addColorStop(1, 'rgba(255, 50, 100, 0)');
            ctx.fillStyle = tipGrad;
            ctx.beginPath();
            ctx.arc(18, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();

        // Center core
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        // Spinning ring
        let spinAngle = time * 0.006;
        ctx.strokeStyle = `rgba(255, 50, 100, 0.4)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 6, spinAngle, spinAngle + Math.PI * 1.2);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

class ShieldGenerator extends Entity {
    constructor(x, y) {
        super(x, y);
        this.shieldRadius = 120;
        this.shieldHp = 150;
        this.maxShieldHp = 150;
        this.regenRate = 10;
        this.slowAmount = 0.35;
        this.dps = 10;
        this.color = '#4488ff';
        this.isActive = true;
        this.rechargeTimer = 0;
        this.hitFlash = 0;
        this.dmgTextTimer = 0;
    }

    update(dt, enemies, game) {
        if (!this.isActive) {
            this.rechargeTimer -= dt;
            if (this.rechargeTimer <= 0) {
                this.isActive = true;
                this.shieldHp = this.maxShieldHp * 0.5;
                game.spawnParticles(this.x, this.y, 10, this.color);
            }
            return;
        }

        // Regenerate shield
        this.shieldHp = Math.min(this.maxShieldHp, this.shieldHp + this.regenRate * (dt / 1000));
        this.hitFlash *= 0.92;
        this.dmgTextTimer -= dt;

        // Affect enemies inside shield
        let shieldDmgShown = false;
        for (let e of enemies) {
            if (e.hp <= 0) continue;
            let dist = Math.hypot(e.x - this.x, e.y - this.y);
            if (dist < this.shieldRadius) {
                // Slow enemy
                e.slowFactor = this.slowAmount;
                // Damage enemy
                e.hp -= this.dps * (dt / 1000);
                // Show damage text periodically
                if (!shieldDmgShown && this.dmgTextTimer <= 0) {
                    game.spawnDamageText(e.x, e.y - 15, Math.round(this.dps * 0.35), '#88bbff');
                    shieldDmgShown = true;
                    this.dmgTextTimer = 350;
                }
                // Shield takes strain from contact
                this.shieldHp -= 0.3 * (dt / 16);
                this.hitFlash = 0.6;
            }
        }

        if (this.shieldHp <= 0) {
            this.isActive = false;
            this.rechargeTimer = 4000;
            game.spawnParticles(this.x, this.y, 25, this.color);
            game.screenShake = 3;
        }
    }

    draw(ctx) {
        const time = Date.now();

        // Shield dome with hexagonal tessellation
        if (this.isActive) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const hpRatio = this.shieldHp / this.maxShieldHp;
            const pulse = Math.sin(time * 0.003) * 0.05;
            const R = this.shieldRadius;
            const cx = this.x;
            const cy = this.y;

            // Clip to dome circle
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.clip();

            // AT Field dome fill — vivid energy field
            let domeGrad = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
            domeGrad.addColorStop(0, `rgba(20, 80, 255, ${(0.03 + pulse) * hpRatio})`);
            domeGrad.addColorStop(0.4, `rgba(40, 120, 255, ${(0.06 + pulse + this.hitFlash * 0.15) * hpRatio})`);
            domeGrad.addColorStop(0.75, `rgba(60, 150, 255, ${(0.12 + pulse + this.hitFlash * 0.3) * hpRatio})`);
            domeGrad.addColorStop(1, `rgba(100, 200, 255, ${(0.25 + pulse + this.hitFlash * 0.5) * hpRatio})`);
            ctx.fillStyle = domeGrad;
            ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

            // Hexagonal honeycomb grid — AT Field style
            const hexR = 18;
            const hexH = hexR * Math.sqrt(3);
            const hexW = hexR * 2;
            const gridRange = Math.ceil(R / hexR) + 1;
            const baseAlpha = (0.25 + pulse * 0.6 + this.hitFlash * 0.5) * hpRatio;

            for (let row = -gridRange; row <= gridRange; row++) {
                for (let col = -gridRange; col <= gridRange; col++) {
                    const offset = (Math.abs(col) % 2 === 1) ? hexH * 0.5 : 0;
                    const hx = col * hexW * 0.75;
                    const hy = row * hexH + offset;
                    const dist = Math.hypot(hx, hy);
                    if (dist > R + hexR * 0.5) continue;

                    // Energy wave + edge brightening
                    const edgeFactor = Math.pow(dist / R, 1.2);
                    const wave = Math.sin(dist * 0.05 - time * 0.005) * 0.5 + 0.5;
                    const cellAlpha = baseAlpha * (0.35 + edgeFactor * 0.65) * (0.6 + wave * 0.4);

                    // Fill each hex cell with translucent energy
                    ctx.beginPath();
                    for (let v = 0; v < 6; v++) {
                        const a = (Math.PI / 3) * v + Math.PI / 6;
                        const vx = cx + hx + Math.cos(a) * hexR * 0.88;
                        const vy = cy + hy + Math.sin(a) * hexR * 0.88;
                        if (v === 0) ctx.moveTo(vx, vy);
                        else ctx.lineTo(vx, vy);
                    }
                    ctx.closePath();

                    // Cell fill — visible even without hit
                    const fillAlpha = cellAlpha * (0.12 + edgeFactor * 0.2 + this.hitFlash * edgeFactor * 0.4);
                    ctx.fillStyle = `rgba(100, 180, 255, ${fillAlpha})`;
                    ctx.fill();

                    // Bright hex border lines
                    ctx.strokeStyle = `rgba(130, 210, 255, ${cellAlpha})`;
                    ctx.lineWidth = 1.0 + edgeFactor * 1.0;
                    ctx.stroke();

                    // Hit flash: cells near edge flare bright
                    if (this.hitFlash > 0.1 && edgeFactor > 0.5) {
                        ctx.fillStyle = `rgba(200, 240, 255, ${this.hitFlash * edgeFactor * 0.25 * hpRatio})`;
                        ctx.fill();
                    }
                }
            }

            ctx.restore(); // Unclip

            // Dome edge — bold AT Field boundary ring
            ctx.strokeStyle = `rgba(100, 200, 255, ${(0.7 + pulse + this.hitFlash * 0.3) * hpRatio})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.stroke();

            // Outer glow ring
            ctx.strokeStyle = `rgba(60, 150, 255, ${(0.35 + this.hitFlash * 0.5) * hpRatio})`;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.arc(cx, cy, R + 4, 0, Math.PI * 2);
            ctx.stroke();

            // Inner crisp ring
            ctx.strokeStyle = `rgba(180, 230, 255, ${(0.25 + pulse) * hpRatio})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, R - 3, 0, Math.PI * 2);
            ctx.stroke();

            ctx.globalCompositeOperation = 'source-over';
            ctx.restore();
        }

        // Ground tether
        const tGrad = ctx.createLinearGradient(this.x, this.y + 10, this.x, ctx.canvas.height);
        tGrad.addColorStop(0, `rgba(68, 136, 255, ${this.isActive ? 0.12 : 0.04})`);
        tGrad.addColorStop(1, 'rgba(40, 80, 200, 0)');
        ctx.strokeStyle = tGrad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + 12);
        ctx.lineTo(this.x, ctx.canvas.height);
        ctx.stroke();

        // Generator base
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.shadowBlur = 12;
        ctx.shadowColor = this.isActive ? this.color : '#333';
        ctx.fillStyle = '#081828';
        ctx.strokeStyle = this.isActive ? this.color : '#444';
        ctx.lineWidth = 1.5;

        // Circular base
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Center core
        ctx.fillStyle = this.isActive ? this.color : '#555';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        // Shield HP arc indicator
        if (this.isActive) {
            const hpRatio = this.shieldHp / this.maxShieldHp;
            ctx.strokeStyle = hpRatio > 0.3 ? this.color : '#ff3300';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpRatio);
            ctx.stroke();
        } else {
            // Recharge progress
            const rechargeRatio = 1 - (this.rechargeTimer / 4000);
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * rechargeRatio);
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

class MissileTower extends Entity {
    constructor(x, y) {
        super(x, y);
        this.range = 550;
        this.damage = 45;
        this.splashRadius = 65;
        this.fireRate = 1600;
        this.cooldown = 0;
        this.color = '#ff8800';
        this.target = null;
        this.aimAngle = -Math.PI / 2;
        this.flashTimer = 0;
    }

    update(dt, enemies, game) {
        this.cooldown -= dt;
        this.flashTimer -= dt;
        this.target = null;
        let maxHp = 0;
        for (let e of enemies) {
            if (e.hp <= 0) continue;
            let dist = Math.hypot(e.x - this.x, e.y - this.y);
            if (dist < this.range && e.hp > maxHp) {
                maxHp = e.hp;
                this.target = e;
            }
        }
        if (this.target) {
            let desired = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            let diff = desired - this.aimAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.aimAngle += diff * 0.1;
        }
        if (this.target && this.cooldown <= 0) {
            game.projectiles.push(new HomingMissile(this.x, this.y, this.target, this.damage, this.splashRadius));
            this.cooldown = this.fireRate;
            this.flashTimer = 120;
            game.screenShake = Math.max(game.screenShake, 1.5);
        }
    }

    draw(ctx) {
        const time = Date.now();
        // Ground tether
        const tGrad = ctx.createLinearGradient(this.x, this.y + 10, this.x, ctx.canvas.height);
        tGrad.addColorStop(0, 'rgba(255, 136, 0, 0.12)');
        tGrad.addColorStop(1, 'rgba(200, 80, 0, 0)');
        ctx.strokeStyle = tGrad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + 12);
        ctx.lineTo(this.x, ctx.canvas.height);
        ctx.stroke();

        ctx.save();
        ctx.translate(this.x, this.y);

        // Square base
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.fillStyle = '#181008';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.5;
        ctx.fillRect(-10, -10, 20, 20);
        ctx.strokeRect(-10, -10, 20, 20);

        // Launcher barrel
        ctx.save();
        ctx.rotate(this.aimAngle);
        ctx.fillStyle = '#333';
        ctx.fillRect(4, -4, 16, 8);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(4, -4, 16, 8);
        // Missile tip indicator
        ctx.fillStyle = this.color;
        ctx.fillRect(18, -2, 4, 4);

        // Launch flash
        if (this.flashTimer > 0) {
            ctx.globalCompositeOperation = 'lighter';
            let fa = this.flashTimer / 120;
            let flashGrad = ctx.createRadialGradient(20, 0, 0, 20, 0, 14);
            flashGrad.addColorStop(0, `rgba(255, 200, 100, ${fa})`);
            flashGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
            ctx.fillStyle = flashGrad;
            ctx.beginPath();
            ctx.arc(20, 0, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();

        // Center core
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        // Spinning ring
        ctx.strokeStyle = 'rgba(255, 136, 0, 0.4)';
        ctx.lineWidth = 1;
        let spin = time * 0.003;
        ctx.beginPath();
        ctx.arc(0, 0, 7, spin, spin + Math.PI);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

class TeslaTower extends Entity {
    constructor(x, y) {
        super(x, y);
        this.range = 280;
        this.dps = 22;
        this.chainCount = 4;
        this.chainRange = 130;
        this.color = '#aaeeff';
        this.targets = [];
        this.dmgTextTimer = 0;
        this.arcSeed = 0;
    }

    update(dt, enemies, game) {
        this.dmgTextTimer -= dt;
        this.targets = [];

        let primary = null;
        let minDist = this.range;
        for (let e of enemies) {
            if (e.hp <= 0) continue;
            let dist = Math.hypot(e.x - this.x, e.y - this.y);
            if (dist < minDist) {
                minDist = dist;
                primary = e;
            }
        }

        if (primary) {
            this.targets.push(primary);
            let last = primary;
            for (let c = 0; c < this.chainCount - 1; c++) {
                let next = null;
                let nextDist = this.chainRange;
                for (let e of enemies) {
                    if (e.hp <= 0 || this.targets.includes(e)) continue;
                    let dist = Math.hypot(e.x - last.x, e.y - last.y);
                    if (dist < nextDist) {
                        nextDist = dist;
                        next = e;
                    }
                }
                if (next) {
                    this.targets.push(next);
                    last = next;
                } else break;
            }

            for (let t of this.targets) {
                t.hp -= this.dps * (dt / 1000);
            }

            if (this.dmgTextTimer <= 0 && this.targets.length > 0) {
                for (let t of this.targets) {
                    game.spawnDamageText(t.x, t.y - 15, Math.round(this.dps * 0.28), '#aaeeff');
                }
                this.dmgTextTimer = 280;
            }
        }

        // Refresh arc shape periodically
        if (Math.random() > 0.7) this.arcSeed = Math.random() * 1000;
    }

    drawArc(ctx, x1, y1, x2, y2) {
        const segments = 7;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy);
        const jitter = dist * 0.12;
        const seed = this.arcSeed;

        let pts = [{ x: x1, y: y1 }];
        for (let i = 1; i < segments; i++) {
            let t = i / segments;
            pts.push({
                x: x1 + dx * t + Math.sin(seed + i * 7.3) * jitter,
                y: y1 + dy * t + Math.cos(seed + i * 5.1) * jitter
            });
        }
        pts.push({ x: x2, y: y2 });

        // Wide glow
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.25)';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();

        // Mid
        ctx.strokeStyle = 'rgba(180, 230, 255, 0.5)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();

        // Core
        ctx.strokeStyle = 'rgba(240, 250, 255, 0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
    }

    draw(ctx) {
        const time = Date.now();

        // Chain lightning arcs
        if (this.targets.length > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            let points = [{ x: this.x, y: this.y }, ...this.targets.map(t => ({ x: t.x, y: t.y }))];
            for (let i = 0; i < points.length - 1; i++) {
                this.drawArc(ctx, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
            }
            // Hit point sparks
            for (let t of this.targets) {
                let sparkGrad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 12);
                sparkGrad.addColorStop(0, 'rgba(200, 240, 255, 0.6)');
                sparkGrad.addColorStop(1, 'rgba(100, 200, 255, 0)');
                ctx.fillStyle = sparkGrad;
                ctx.beginPath();
                ctx.arc(t.x, t.y, 12, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
            ctx.restore();
        }

        // Ground tether
        const tGrad = ctx.createLinearGradient(this.x, this.y + 10, this.x, ctx.canvas.height);
        tGrad.addColorStop(0, 'rgba(170, 238, 255, 0.12)');
        tGrad.addColorStop(1, 'rgba(100, 180, 255, 0)');
        ctx.strokeStyle = tGrad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + 12);
        ctx.lineTo(this.x, ctx.canvas.height);
        ctx.stroke();

        ctx.save();
        ctx.translate(this.x, this.y);

        // Triangle base
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.fillStyle = '#081018';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(10, 8);
        ctx.lineTo(-10, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Tesla coil top
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(0, -16);
        ctx.stroke();

        // Coil tip spark
        if (this.targets.length > 0) {
            ctx.globalCompositeOperation = 'lighter';
            let sparkGrad = ctx.createRadialGradient(0, -16, 0, 0, -16, 8);
            sparkGrad.addColorStop(0, 'rgba(220, 245, 255, 0.8)');
            sparkGrad.addColorStop(0.5, 'rgba(100, 200, 255, 0.3)');
            sparkGrad.addColorStop(1, 'rgba(50, 150, 255, 0)');
            ctx.fillStyle = sparkGrad;
            ctx.beginPath();
            ctx.arc(0, -16, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }

        // Center core
        ctx.fillStyle = this.targets.length > 0 ? '#fff' : this.color;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        // Spinning arcs
        let spin = time * 0.005;
        ctx.strokeStyle = 'rgba(170, 238, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, -4, 7, spin, spin + Math.PI * 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -4, 7, spin + Math.PI, spin + Math.PI * 1.8);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

class Projectile extends Entity {
    constructor(x, y, target, damage) {
        super(x, y);
        this.damage = damage;
        this.speed = 1.2;
        this.life = 1000;
        this.size = 3;

        this.angle = Math.atan2(target.y - y, target.x - x);
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
        this.trail = [];
        this.trailMax = 8;
    }

    update(dt) {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.trailMax) this.trail.shift();
        this.life -= dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const tailX = this.x - this.vx * 35;
        const tailY = this.y - this.vy * 35;

        // Layer 1: Ultra-wide outer glow
        const outerGrad = ctx.createLinearGradient(this.x, this.y, tailX, tailY);
        outerGrad.addColorStop(0, 'rgba(0, 200, 255, 0.35)');
        outerGrad.addColorStop(0.4, 'rgba(0, 100, 255, 0.1)');
        outerGrad.addColorStop(1, 'rgba(0, 50, 200, 0)');
        ctx.strokeStyle = outerGrad;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Layer 2: Mid glow
        const glowGrad = ctx.createLinearGradient(this.x, this.y, tailX, tailY);
        glowGrad.addColorStop(0, 'rgba(0, 243, 255, 0.7)');
        glowGrad.addColorStop(0.5, 'rgba(0, 150, 255, 0.3)');
        glowGrad.addColorStop(1, 'rgba(0, 50, 200, 0)');
        ctx.strokeStyle = glowGrad;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Layer 3: Bright core
        const coreGrad = ctx.createLinearGradient(this.x, this.y, tailX, tailY);
        coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        coreGrad.addColorStop(0.3, 'rgba(180, 240, 255, 0.7)');
        coreGrad.addColorStop(1, 'rgba(0, 150, 255, 0)');
        ctx.strokeStyle = coreGrad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Bright head with flare
        let headGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 8);
        headGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        headGrad.addColorStop(0.3, 'rgba(150, 240, 255, 0.6)');
        headGrad.addColorStop(1, 'rgba(0, 150, 255, 0)');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }
}

class HomingMissile extends Entity {
    constructor(x, y, target, damage, splashRadius) {
        super(x, y);
        this.target = target;
        this.damage = damage;
        this.splash = splashRadius;
        this.speed = 0.55;
        this.life = 3000;
        this.size = 4;
        this.angle = Math.atan2(target.y - y, target.x - x);
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
        this.trail = [];
        this.trailMax = 14;
        this.turnRate = 0.0035;
        this.accel = 0.0004;
    }

    update(dt) {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.trailMax) this.trail.shift();
        this.life -= dt;

        // Homing: steer toward target
        if (this.target && this.target.hp > 0) {
            let desired = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            let diff = desired - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.angle += Math.sign(diff) * Math.min(Math.abs(diff), this.turnRate * dt);
        }

        // Accelerate over time
        this.speed = Math.min(this.speed + this.accel * dt, 1.8);
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;

        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const tailLen = 40;
        const tailX = this.x - Math.cos(this.angle) * tailLen;
        const tailY = this.y - Math.sin(this.angle) * tailLen;

        // Outer flame glow
        const outerGrad = ctx.createLinearGradient(this.x, this.y, tailX, tailY);
        outerGrad.addColorStop(0, 'rgba(255, 160, 0, 0.4)');
        outerGrad.addColorStop(0.4, 'rgba(255, 80, 0, 0.15)');
        outerGrad.addColorStop(1, 'rgba(200, 40, 0, 0)');
        ctx.strokeStyle = outerGrad;
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Mid flame
        const midGrad = ctx.createLinearGradient(this.x, this.y, tailX, tailY);
        midGrad.addColorStop(0, 'rgba(255, 200, 50, 0.7)');
        midGrad.addColorStop(0.5, 'rgba(255, 120, 0, 0.3)');
        midGrad.addColorStop(1, 'rgba(200, 50, 0, 0)');
        ctx.strokeStyle = midGrad;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Core
        const coreGrad = ctx.createLinearGradient(this.x, this.y, tailX, tailY);
        coreGrad.addColorStop(0, 'rgba(255, 255, 220, 0.95)');
        coreGrad.addColorStop(0.3, 'rgba(255, 220, 100, 0.6)');
        coreGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
        ctx.strokeStyle = coreGrad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Missile head glow
        let headGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 10);
        headGrad.addColorStop(0, 'rgba(255, 255, 200, 1)');
        headGrad.addColorStop(0.3, 'rgba(255, 180, 50, 0.6)');
        headGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 4 + 1;
        this.speedX = (Math.random() - 0.5) * 0.6;
        this.speedY = (Math.random() - 0.5) * 0.6;
        this.life = 300 + Math.random() * 300;
        this.maxLife = this.life;
        this.drag = 0.98;
    }

    update(dt) {
        this.x += this.speedX * dt;
        this.y += this.speedY * dt;
        this.speedX *= this.drag;
        this.speedY *= this.drag;
        this.life -= dt;
    }

    draw(ctx) {
        let alpha = Math.max(0, this.life / this.maxLife);
        let currentSize = this.size * alpha;
        if (currentSize < 0.1) return;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Soft glow halo
        let glowGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, currentSize * 3);
        glowGrad.addColorStop(0, this.color);
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentSize * 3, 0, Math.PI * 2);
        ctx.fill();

        // Bright core
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentSize * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

class DamageText {
    constructor(x, y, amount, color) {
        this.x = x + (Math.random() - 0.5) * 20;
        this.y = y;
        this.amount = Math.round(amount);
        this.color = color;
        this.life = 700;
        this.maxLife = 700;
        this.vy = -0.07;
        this.scale = 0;
    }

    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
        const progress = 1 - this.life / this.maxLife;
        if (progress < 0.12) {
            this.scale = progress / 0.12;
        } else {
            this.scale = 1;
        }
    }

    draw(ctx) {
        const alpha = Math.max(0, this.life / this.maxLife);
        if (alpha <= 0) return;

        const fontSize = Math.floor(14 + this.scale * 4);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${fontSize}px Orbitron, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Black outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeText(`-${this.amount}`, this.x, this.y);

        // Main text
        ctx.fillStyle = this.color;
        ctx.fillText(`-${this.amount}`, this.x, this.y);

        // Glow on large hits
        if (this.amount >= 10) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = alpha * 0.3;
            ctx.fillStyle = this.color;
            ctx.fillText(`-${this.amount}`, this.x, this.y);
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

class Explosion {
    constructor(x, y, color, radius) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.maxRadius = radius;
        this.radius = 0;
        this.life = 350;
        this.maxLife = 350;
    }

    update(dt) {
        this.life -= dt;
        const progress = 1 - this.life / this.maxLife;
        this.radius = this.maxRadius * Math.pow(progress, 0.4);
    }

    draw(ctx) {
        const alpha = Math.max(0, this.life / this.maxLife);
        if (alpha <= 0) return;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Expanding ring
        ctx.globalAlpha = alpha * 0.7;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3 * alpha + 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Second thinner ring
        ctx.globalAlpha = alpha * 0.4;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.7, 0, Math.PI * 2);
        ctx.stroke();

        // Inner flash (bright center that fades fast)
        const flashAlpha = Math.pow(alpha, 2);
        if (flashAlpha > 0.1) {
            let grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 0.6);
            grad.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha * 0.5})`);
            grad.addColorStop(0.3, `rgba(255, 200, 100, ${flashAlpha * 0.3})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

const game = new Game();
