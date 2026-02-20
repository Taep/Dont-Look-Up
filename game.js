export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();

        this.lastTime = 0;
        this.accumulator = 0;
        this.tickRate = 1000 / 60;

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
        this.towerCosts = { turret: 50, laser: 75, shield: 100 };

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
        for (let i = 0; i < 8; i++) {
            this.debris.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height * 0.5,
                size: 1 + Math.random() * 3,
                speed: 0.3 + Math.random() * 0.8,
                angle: Math.PI * 0.4 + Math.random() * 0.3,
                trailLen: 20 + Math.random() * 40,
                life: Math.random() * 1000
            });
        }
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

        // Enemy count scales with wave AND current planet proximity (TEST: boosted)
        const approachBonus = Math.floor(this.planetApproach * 20);
        this.enemiesToSpawn = 10 + (this.wave * 8) + approachBonus;
        this.spawnTimer = 0;

        // Capital ships more frequent as planet approaches
        const shipChance = this.planetApproach > 0.3 ? 0.8 : 0.4;
        if (this.wave % 2 === 0 || Math.random() < shipChance) {
            this.capitalShips.push(new CapitalShip(this.width, this.height));
        }
        if (this.planetApproach > 0.5 && Math.random() < 0.5) {
            this.capitalShips.push(new CapitalShip(this.width, this.height));
        }

        // Spawn extra debris as planet gets closer
        const extraDebris = Math.floor(this.planetApproach * 15);
        for (let i = 0; i < extraDebris; i++) {
            this.debris.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height * 0.5,
                size: 1 + Math.random() * 3,
                speed: 0.3 + Math.random() * 0.8,
                angle: Math.PI * 0.4 + Math.random() * 0.3,
                trailLen: 20 + Math.random() * 40,
                life: Math.random() * 1000
            });
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

        this.enemies.push(new Enemy(x, y, targetX, targetY, this.wave, this.planetApproach));
        // Flash the planet when it "launches" an enemy
        this.spawnFlash = 0.6;
    }

    spawnParticles(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
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
        this.debris.forEach(d => {
            d.x += Math.cos(d.angle) * d.speed * dt * 0.05;
            d.y += Math.sin(d.angle) * d.speed * dt * 0.05;
            d.life += dt;
            if (d.y > this.height || d.x < -50 || d.x > this.width + 50) {
                d.x = Math.random() * this.width;
                d.y = -20;
                d.life = 0;
            }
        });

        // Wave Logic — spawn rate intensifies with planet approach
        if (this.enemiesToSpawn > 0) {
            this.spawnTimer += dt;
            // Base interval shrinks with wave, ALSO shrinks further with planet proximity
            const baseInterval = 800 - Math.min(600, this.wave * 40);
            const approachSpeedup = 1.0 - this.planetApproach * 0.6;
            const spawnInterval = Math.max(100, baseInterval * approachSpeedup);
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
                    this.spawnParticles(e.x, e.y, 5, '#ffa500');
                    hit = true;
                    if (e.hp <= 0) {
                        this.credits += e.reward;
                        this.enemies.splice(j, 1);
                        this.spawnParticles(e.x, e.y, 15, '#ff0055');
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
                this.credits += this.enemies[i].reward;
                this.spawnParticles(this.enemies[i].x, this.enemies[i].y, 15, '#ff0055');
                this.enemies.splice(i, 1);
                this.updateHud();
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
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
        // Starts high above screen, descends into view as it approaches
        const cy = -r * 0.75 + approach * H * 0.45;

        // Planet body — slightly lighter than pure black so it's visible
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();

        const planetGrad = ctx.createRadialGradient(cx, cy + r * 0.5, r * 0.1, cx, cy, r);
        planetGrad.addColorStop(0, '#140828');   // Visible dark purple center
        planetGrad.addColorStop(0.4, '#0a0418');
        planetGrad.addColorStop(0.8, '#050010');
        planetGrad.addColorStop(1, '#020008');
        ctx.fillStyle = planetGrad;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

        // Banding texture — more visible
        const bandAlphaBoost = 1.5 + approach * 2;
        for (let i = 0; i < 50; i++) {
            let yOff = (i / 50) * r * 2 - r;
            let bandH = (r * 2) / 50;

            ctx.beginPath();
            ctx.ellipse(cx, cy + yOff, r, bandH * 3, 0, 0, Math.PI * 2);

            let alpha = (0.03 + Math.random() * 0.08) * bandAlphaBoost;
            let color;
            switch (i % 5) {
                case 0: color = `rgba(120, 40, 160, ${alpha})`; break;
                case 1: color = `rgba(40, 70, 140, ${alpha})`; break;
                case 2: color = `rgba(160, 60, 90, ${alpha})`; break;
                case 3: color = `rgba(30, 90, 120, ${alpha})`; break;
                default: color = `rgba(20, 10, 40, ${alpha})`; break;
            }
            ctx.fillStyle = color;
            ctx.fill();
        }

        // Surface detail — subtle "storm" swirls
        const stormX = cx + Math.sin(time * 0.0003) * r * 0.2;
        const stormY = cy + r * 0.3;
        const stormGrad = ctx.createRadialGradient(stormX, stormY, 0, stormX, stormY, r * 0.25);
        stormGrad.addColorStop(0, `rgba(100, 40, 140, ${0.08 + approach * 0.05})`);
        stormGrad.addColorStop(0.5, `rgba(60, 20, 100, ${0.04})`);
        stormGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = stormGrad;
        ctx.beginPath();
        ctx.ellipse(stormX, stormY, r * 0.25, r * 0.1, Math.sin(time * 0.0002) * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // BURNING ATMOSPHERE — strong from the start, intensifies
        ctx.globalCompositeOperation = 'lighter';
        const heatBase = 0.15 + approach * 0.25;
        const heatPulse = heatBase + Math.sin(time * 0.003) * 0.06;

        // Primary burn at bottom edge
        const burnGrad = ctx.createRadialGradient(cx, cy + r * 0.8, r * 0.05, cx, cy + r * 0.4, r * 0.7);
        burnGrad.addColorStop(0, `rgba(255, 130, 30, ${heatPulse})`);
        burnGrad.addColorStop(0.4, `rgba(255, 70, 10, ${heatPulse * 0.6})`);
        burnGrad.addColorStop(1, 'rgba(200, 30, 0, 0)');
        ctx.fillStyle = burnGrad;
        ctx.fillRect(cx - r, cy, r * 2, r);

        // Secondary burn — wide glow
        const burnGrad2 = ctx.createRadialGradient(cx, cy + r * 0.95, r * 0.05, cx, cy + r * 0.6, r * 0.5);
        burnGrad2.addColorStop(0, `rgba(255, 220, 80, ${heatPulse * 0.7})`);
        burnGrad2.addColorStop(1, 'rgba(255, 80, 0, 0)');
        ctx.fillStyle = burnGrad2;
        ctx.fillRect(cx - r, cy, r * 2, r);

        // Spawn flash — planet pulses bright when launching enemies
        if (this.spawnFlash > 0.05) {
            const flashGrad = ctx.createRadialGradient(cx, cy + r * 0.9, 0, cx, cy + r * 0.5, r * 0.4);
            flashGrad.addColorStop(0, `rgba(255, 255, 200, ${this.spawnFlash * 0.6})`);
            flashGrad.addColorStop(0.5, `rgba(255, 150, 50, ${this.spawnFlash * 0.35})`);
            flashGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');
            ctx.fillStyle = flashGrad;
            ctx.fillRect(cx - r, cy, r * 2, r);
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();

        // Rim Light — visible from start, intensifies
        ctx.save();
        const rimIntensity = 0.6 + approach * 0.4;
        ctx.shadowBlur = 80 + approach * 120;
        ctx.shadowColor = approach > 0.5 ? '#ff2200' : '#ff6600';
        ctx.strokeStyle = `rgba(255, ${Math.floor(180 - approach * 100)}, 40, ${rimIntensity + Math.sin(time * 0.004) * 0.15})`;
        ctx.lineWidth = 4 + approach * 6 + Math.sin(time * 0.005) * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI * 0.08, Math.PI * 0.92);
        ctx.stroke();

        // Second inner rim for depth
        ctx.shadowBlur = 40;
        ctx.shadowColor = '#ffaa00';
        ctx.strokeStyle = `rgba(255, 200, 100, ${rimIntensity * 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.99, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();

        // Atmospheric scatter — orange haze below planet
        const atmosSpread = 200 + approach * 250;
        const atmosIntensity = 0.06 + approach * 0.14;
        const atmosGrad = ctx.createLinearGradient(0, cy + r - atmosSpread, 0, cy + r + 250);
        atmosGrad.addColorStop(0, 'rgba(0,0,0,0)');
        atmosGrad.addColorStop(0.25, `rgba(255, 80, 20, ${atmosIntensity + Math.sin(time * 0.002) * 0.02})`);
        atmosGrad.addColorStop(0.5, `rgba(255, 120, 40, ${atmosIntensity * 0.8})`);
        atmosGrad.addColorStop(0.75, `rgba(200, 60, 20, ${atmosIntensity * 0.3})`);
        atmosGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = atmosGrad;
        ctx.fillRect(0, cy + r - atmosSpread, W, atmosSpread + 250);

        // ============================================================
        // 5. FALLING DEBRIS (shooting stars in the atmosphere)
        // ============================================================
        this.debris.forEach(d => {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const dx = Math.cos(d.angle);
            const dy = Math.sin(d.angle);

            // Outer wide glow trail
            const glowGrad = ctx.createLinearGradient(
                d.x, d.y,
                d.x - dx * d.trailLen * 1.2, d.y - dy * d.trailLen * 1.2
            );
            glowGrad.addColorStop(0, `rgba(255, 180, 80, 0.5)`);
            glowGrad.addColorStop(0.4, 'rgba(255, 80, 20, 0.15)');
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
            coreGrad.addColorStop(0, 'rgba(255, 255, 230, 0.9)');
            coreGrad.addColorStop(0.3, 'rgba(255, 200, 100, 0.5)');
            coreGrad.addColorStop(1, 'rgba(255, 80, 0, 0)');
            ctx.strokeStyle = coreGrad;
            ctx.lineWidth = d.size;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - dx * d.trailLen, d.y - dy * d.trailLen);
            ctx.stroke();

            // Bright head with flare
            let headGrad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.size * 3);
            headGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            headGrad.addColorStop(0.4, 'rgba(255, 200, 100, 0.5)');
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
                    // Inner edge (toward center) gets the rim light
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
                            // Variety of window colors: mostly cyan, some warm
                            let wColor;
                            if (w.bright > 0.95) {
                                wColor = '#ff0055'; // Red accent
                            } else if (w.bright > 0.8) {
                                wColor = `rgba(255, 200, 100, ${0.4 + idx * 0.15})`; // Warm
                            } else {
                                wColor = `rgba(80, 180, 255, ${0.2 + idx * 0.2})`; // Cyan
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
        this.particles.forEach(p => p.draw(ctx));

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
    }

    update(dt) {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.trailMax) this.trail.shift();

        const effectiveSpeed = this.speed * this.slowFactor;
        this.slowFactor = 1; // Reset — shields re-apply each frame

        this.x += Math.cos(this.angle) * effectiveSpeed * dt;
        this.y += Math.sin(this.angle) * effectiveSpeed * dt;
        this.x += Math.sin(this.y * 0.05) * 0.5;

        // Spawn sparks that break off from the trail
        if (Math.random() > 0.6 && this.trail.length > 5) {
            let src = this.trail[this.trail.length - Math.floor(Math.random() * 5) - 1];
            this.sparks.push({
                x: src.x + (Math.random() - 0.5) * 6,
                y: src.y + (Math.random() - 0.5) * 6,
                vx: (Math.random() - 0.5) * 0.15,
                vy: (Math.random() - 0.5) * 0.15 + 0.05,
                life: 150 + Math.random() * 200,
                maxLife: 350,
                size: 0.5 + Math.random() * 1.5
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

        // 1. Outer glow trail (wide, soft, orange-red)
        for (let i = 1; i < len; i++) {
            let t0 = this.trail[i - 1];
            let t1 = this.trail[i];
            let ratio = i / len;

            let width = ratio < 0.85
                ? ratio * 16
                : (1 - (ratio - 0.85) / 0.15) * 16;

            let alpha = ratio * 0.4;
            ctx.strokeStyle = `rgba(255, ${Math.floor(40 + ratio * 130)}, ${Math.floor(ratio * 30)}, ${alpha})`;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(t0.x, t0.y);
            ctx.lineTo(t1.x, t1.y);
            ctx.stroke();
        }

        // 2. Inner core trail (narrow, white-hot)
        for (let i = 1; i < len; i++) {
            let t0 = this.trail[i - 1];
            let t1 = this.trail[i];
            let ratio = i / len;

            let width = ratio < 0.85
                ? ratio * 6
                : (1 - (ratio - 0.85) / 0.15) * 6;

            ctx.strokeStyle = `rgba(255, 255, ${Math.floor(200 + ratio * 55)}, ${ratio * 0.8})`;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(t0.x, t0.y);
            ctx.lineTo(t1.x, t1.y);
            ctx.stroke();
        }

        // 3. Sparks breaking off
        this.sparks.forEach(s => {
            let a = s.life / s.maxLife;
            ctx.fillStyle = `rgba(255, ${150 + Math.floor(Math.random() * 100)}, 50, ${a * 0.8})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size * a, 0, Math.PI * 2);
            ctx.fill();
        });

        // 4. Meteor HEAD — just a bright glowing ball, no arrow shape
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#ffaa00';

        // Wide halo
        let headGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 22);
        headGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        headGrad.addColorStop(0.15, 'rgba(255, 240, 180, 0.8)');
        headGrad.addColorStop(0.4, 'rgba(255, 150, 50, 0.3)');
        headGrad.addColorStop(0.7, 'rgba(255, 80, 10, 0.1)');
        headGrad.addColorStop(1, 'rgba(255, 40, 0, 0)');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 22, 0, Math.PI * 2);
        ctx.fill();

        // White-hot core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();

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
            this.target.hp -= this.dps * (dt / 1000) * this.beamIntensity;
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

            // Wide glow beam
            ctx.strokeStyle = `rgba(255, 50, 100, ${intensity * 0.25})`;
            ctx.lineWidth = 10 * intensity;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.target.x, this.target.y);
            ctx.stroke();

            // Mid beam
            ctx.strokeStyle = `rgba(255, 120, 160, ${intensity * 0.5})`;
            ctx.lineWidth = 4 * intensity;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.target.x, this.target.y);
            ctx.stroke();

            // Core beam (white-hot)
            ctx.strokeStyle = `rgba(255, 220, 240, ${intensity * 0.9})`;
            ctx.lineWidth = 1.5 * intensity;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.target.x, this.target.y);
            ctx.stroke();

            // Hit point glow
            let hitGrad = ctx.createRadialGradient(
                this.target.x, this.target.y, 0,
                this.target.x, this.target.y, 18
            );
            hitGrad.addColorStop(0, `rgba(255, 200, 220, ${intensity * 0.8})`);
            hitGrad.addColorStop(0.4, `rgba(255, 80, 130, ${intensity * 0.3})`);
            hitGrad.addColorStop(1, 'rgba(255, 50, 100, 0)');
            ctx.fillStyle = hitGrad;
            ctx.beginPath();
            ctx.arc(this.target.x, this.target.y, 18, 0, Math.PI * 2);
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

        // Affect enemies inside shield
        for (let e of enemies) {
            if (e.hp <= 0) continue;
            let dist = Math.hypot(e.x - this.x, e.y - this.y);
            if (dist < this.shieldRadius) {
                // Slow enemy
                e.slowFactor = this.slowAmount;
                // Damage enemy
                e.hp -= this.dps * (dt / 1000);
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

        // Shield dome
        if (this.isActive) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const hpRatio = this.shieldHp / this.maxShieldHp;
            const pulse = Math.sin(time * 0.003) * 0.05;

            // Dome fill
            let domeGrad = ctx.createRadialGradient(
                this.x, this.y, this.shieldRadius * 0.6,
                this.x, this.y, this.shieldRadius
            );
            domeGrad.addColorStop(0, 'rgba(0,0,0,0)');
            domeGrad.addColorStop(0.5, `rgba(40, 100, 255, ${(0.02 + pulse) * hpRatio})`);
            domeGrad.addColorStop(0.85, `rgba(60, 140, 255, ${(0.06 + pulse + this.hitFlash * 0.15) * hpRatio})`);
            domeGrad.addColorStop(1, `rgba(100, 180, 255, ${(0.12 + pulse + this.hitFlash * 0.3) * hpRatio})`);
            ctx.fillStyle = domeGrad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.shieldRadius, 0, Math.PI * 2);
            ctx.fill();

            // Dome edge ring
            ctx.strokeStyle = `rgba(100, 200, 255, ${(0.2 + pulse + this.hitFlash * 0.4) * hpRatio})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.shieldRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Hexagonal energy lines
            for (let i = 0; i < 6; i++) {
                let a = (Math.PI / 3) * i + time * 0.0004;
                let r = this.shieldRadius * 0.7;
                let hx = this.x + Math.cos(a) * r;
                let hy = this.y + Math.sin(a) * r;
                ctx.strokeStyle = `rgba(80, 160, 255, ${0.06 * hpRatio})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(hx, hy);
                ctx.stroke();
            }

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

        // Outer glow trail
        ctx.globalCompositeOperation = 'lighter';
        const tailX = this.x - this.vx * 30;
        const tailY = this.y - this.vy * 30;

        // Wide soft glow
        const glowGrad = ctx.createLinearGradient(this.x, this.y, tailX, tailY);
        glowGrad.addColorStop(0, 'rgba(0, 243, 255, 0.6)');
        glowGrad.addColorStop(0.5, 'rgba(0, 150, 255, 0.2)');
        glowGrad.addColorStop(1, 'rgba(0, 50, 200, 0)');
        ctx.strokeStyle = glowGrad;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Bright core beam
        const coreGrad = ctx.createLinearGradient(this.x, this.y, tailX, tailY);
        coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        coreGrad.addColorStop(0.4, 'rgba(150, 230, 255, 0.6)');
        coreGrad.addColorStop(1, 'rgba(0, 150, 255, 0)');
        ctx.strokeStyle = coreGrad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Bright head point
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f3ff';
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
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

const game = new Game();
