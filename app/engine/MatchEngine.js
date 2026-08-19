// Match Simulation Engine
// Formation-aware, trait-activated, position-weighted match simulation

// Formation role weightings: how many players in each zone
const FORMATION_WEIGHTS = {
    '4-3-3': { defense: 4, midfield: 3, attack: 3 },
    '4-4-2': { defense: 4, midfield: 4, attack: 2 },
    '3-5-2': { defense: 3, midfield: 5, attack: 2 },
    '5-3-2': { defense: 5, midfield: 3, attack: 2 },
    '3-4-3': { defense: 3, midfield: 4, attack: 3 },
};

// Trait effects map - each trait modifies the simulation
const TRAIT_EFFECTS = {
    'Strategist':      { type: 'team_passing', bonus: 8 },
    'Iron Will':       { type: 'defense_clutch', bonus: 15 },  // +def when losing
    'Berserker':       { type: 'shooting_boost', bonus: 12 },
    'Tiger Guard':     { type: 'physical_aura', bonus: 6 },   // team phys boost
    'Lightning Raid':  { type: 'counter_attack', bonus: 20 }, // +shoot after opponent shot
    'Axe Master':      { type: 'tackle_bonus', bonus: 10 },
    'Graceful':        { type: 'pace_boost', bonus: 8 },
    'Fortress':        { type: 'defense_boost', bonus: 10 },
    'Oracle':          { type: 'passing_vision', bonus: 15 }, // +assist chance
    'Patience':        { type: 'momentum_resist', bonus: 12 },
    'Heir':            { type: 'save_bonus', bonus: 8 },
    'Benevolence':     { type: 'team_morale', bonus: 8 },    // team morale boost
    'God of War':      { type: 'defense_anchor', bonus: 15 },
    'Thunderbolt':     { type: 'first_half_boost', bonus: 12 },
    'Dragon':          { type: 'all_round', bonus: 5 },       // +5 all stats
    'Sleeping Dragon': { type: 'second_half_boost', bonus: 15 },
    'Splendor':        { type: 'counter_attack', bonus: 15 },
    'Veteran Archer':  { type: 'long_shot', bonus: 20 },
    'Rebel Spirit':    { type: 'chaos_factor', bonus: 10 },   // more random events
    'Heir of Stars':   { type: 'momentum_gain', bonus: 12 },
    'Phoenix':         { type: 'passing_vision', bonus: 12 },
    'Sharp Mind':      { type: 'save_bonus', bonus: 10 },
    'Tiger of Jiang Dong': { type: 'shooting_boost', bonus: 10 },
    'Little Conqueror': { type: 'pace_boost', bonus: 12 },
    'Ruler':           { type: 'team_morale', bonus: 6 },
    'Fire Tactician':  { type: 'set_piece', bonus: 18 },
    'Young Genius':    { type: 'second_half_boost', bonus: 12 },
    'Pirate King':     { type: 'chaos_factor', bonus: 15 },
    'Loyal Archer':    { type: 'long_shot', bonus: 15 },
    'Fire Ship':       { type: 'physical_aura', bonus: 8 },
    'Scholar General': { type: 'momentum_gain', bonus: 8 },
    'Snow Warrior':    { type: 'defense_boost', bonus: 8 },
    'Scarred Guardian': { type: 'save_bonus', bonus: 15 },
    'Tyrant':          { type: 'fear_factor', bonus: 8 },     // opponent morale debuff
    'Raider':          { type: 'counter_attack', bonus: 12 },
    'Cutthroat':       { type: 'shooting_boost', bonus: 8 },
    'Gate Breaker':    { type: 'physical_aura', bonus: 10 },
    'Dark Counsel':    { type: 'passing_vision', bonus: 12 },
    'Nomad':           { type: 'pace_boost', bonus: 6 },
    'Horseman':        { type: 'pace_boost', bonus: 8 },
    'Loyal Brute':     { type: 'defense_boost', bonus: 8 },
    'Ambusher':        { type: 'counter_attack', bonus: 10 },
    'Poisoned Mind':   { type: 'fear_factor', bonus: 12 },
    'Loyalist':        { type: 'save_bonus', bonus: 8 },
    'Noble Birth':     { type: 'team_morale', bonus: 5 },
    'False Emperor':   { type: 'fear_factor', bonus: 5 },
    'Vanguard':        { type: 'first_half_boost', bonus: 15 },
    'Fearless':        { type: 'shooting_boost', bonus: 10 },
    'Stalwart':        { type: 'defense_anchor', bonus: 10 },
    'Ignored Counsel': { type: 'passing_vision', bonus: 10 },
    'Unheeded':        { type: 'passing_vision', bonus: 8 },
    'Drunkard':        { type: 'save_penalty', bonus: -10 },  // negative!
    'Schemer':         { type: 'momentum_gain', bonus: 6 },
    'Defender of Ye':  { type: 'defense_boost', bonus: 10 },
    'Unrivaled':       { type: 'superstar', bonus: 20 },      // massive individual boost
    'Loyal Advisor':   { type: 'team_passing', bonus: 10 },
    'Camp Breaker':    { type: 'defense_anchor', bonus: 12 },
    'Defector':        { type: 'counter_attack', bonus: 12 },
    'Bandit King':     { type: 'chaos_factor', bonus: 10 },
    'Traitor':         { type: 'morale_penalty', bonus: -5 }, // negative!
    'Opportunist':     { type: 'morale_penalty', bonus: -3 },
    'Turncoat':        { type: 'morale_penalty', bonus: -4 },
    'Enchantress':     { type: 'fear_factor', bonus: 10 },
    'Eye Shot':        { type: 'long_shot', bonus: 18 },
    'Unknown Hero':    { type: 'save_bonus', bonus: 5 },
};

export class MatchEngine {
    constructor(homeTeam, awayTeam) {
        this.home = homeTeam;
        this.away = awayTeam;
        this.events = [];
        this.homeScore = 0;
        this.awayScore = 0;
        this.minute = 0;
        this.possession = { home: 50, away: 50 };
        this.momentum = 0;
        this.homeTraitBonuses = {};
        this.awayTraitBonuses = {};
    }

    // Formation-aware, position-weighted team strength
    getTeamStrength(team, isHome) {
        const players = team.players;
        const formation = team.kingdom?.formation || '4-4-2';
        const weights = FORMATION_WEIGHTS[formation] || FORMATION_WEIGHTS['4-4-2'];

        // Categorize players by their actual position
        const defenders = players.filter(p => ['CB', 'LB', 'RB', 'GK'].includes(p.pos));
        const midfielders = players.filter(p => ['CM', 'LM', 'RM', 'AM'].includes(p.pos));
        const attackers = players.filter(p => ['ST', 'LW', 'RW'].includes(p.pos));

        // Formation fit bonus: players in zone matching formation emphasis get bonus
        const defFit = Math.min(defenders.length, weights.defense) / weights.defense;
        const midFit = Math.min(midfielders.length, weights.midfield) / weights.midfield;
        const attFit = Math.min(attackers.length, weights.attack) / weights.attack;
        const formationFitBonus = (defFit + midFit + attFit) / 3 * 10; // 0-10 bonus

        // Position-weighted stat calculation
        const attack = this.calcZoneStrength(attackers, 'attack') * (weights.attack / 3) +
                      this.calcZoneStrength(midfielders, 'attack') * 0.3;
        const midfield = this.calcZoneStrength(midfielders, 'midfield') * (weights.midfield / 4) +
                        this.calcZoneStrength(attackers, 'midfield') * 0.2 +
                        this.calcZoneStrength(defenders, 'midfield') * 0.2;
        const defense = this.calcZoneStrength(defenders, 'defense') * (weights.defense / 4) +
                       this.calcZoneStrength(midfielders, 'defense') * 0.2;

        // Apply trait bonuses
        const traitBonuses = this.calculateTraitBonuses(players, isHome);
        if (isHome) this.homeTraitBonuses = traitBonuses;
        else this.awayTraitBonuses = traitBonuses;

        return {
            attack: attack + formationFitBonus + (traitBonuses.attackBonus || 0),
            midfield: midfield + formationFitBonus + (traitBonuses.midfieldBonus || 0),
            defense: defense + formationFitBonus + (traitBonuses.defenseBonus || 0),
            overall: (attack + midfield + defense) / 3 + formationFitBonus,
            formationFit: (defFit + midFit + attFit) / 3,
            traitBonuses
        };
    }

    calcZoneStrength(players, zone) {
        if (players.length === 0) return 40; // penalty for empty zone
        const sum = players.reduce((s, p) => {
            if (zone === 'attack') return s + p.stats.shooting * 0.4 + p.stats.pace * 0.35 + p.stats.morale * 0.25;
            if (zone === 'midfield') return s + p.stats.passing * 0.45 + p.stats.morale * 0.3 + p.stats.pace * 0.25;
            if (zone === 'defense') return s + p.stats.defense * 0.45 + p.stats.physical * 0.35 + p.stats.morale * 0.2;
            return s + 50;
        }, 0);
        return sum / players.length;
    }

    calculateTraitBonuses(players, isHome) {
        const bonuses = {
            attackBonus: 0,
            midfieldBonus: 0,
            defenseBonus: 0,
            counterAttack: 0,
            longShot: 0,
            savePenalty: 0,
            chaosFactor: 0,
            fearFactor: 0,
            firstHalf: 0,
            secondHalf: 0,
            momentumGain: 0,
            momentumResist: 0,
            superstar: null,
        };

        players.forEach(player => {
            const traitDef = TRAIT_EFFECTS[player.trait];
            if (!traitDef) return;

            const bonus = traitDef.bonus;
            switch (traitDef.type) {
                case 'shooting_boost':
                case 'pace_boost':
                    bonuses.attackBonus += bonus * 0.3;
                    break;
                case 'team_passing':
                case 'passing_vision':
                    bonuses.midfieldBonus += bonus * 0.4;
                    break;
                case 'defense_boost':
                case 'defense_anchor':
                case 'defense_clutch':
                case 'physical_aura':
                case 'tackle_bonus':
                    bonuses.defenseBonus += bonus * 0.3;
                    break;
                case 'team_morale':
                    bonuses.attackBonus += bonus * 0.15;
                    bonuses.midfieldBonus += bonus * 0.15;
                    bonuses.defenseBonus += bonus * 0.15;
                    break;
                case 'counter_attack':
                    bonuses.counterAttack += bonus;
                    break;
                case 'long_shot':
                    bonuses.longShot += bonus;
                    break;
                case 'save_bonus':
                    bonuses.savePenalty -= bonus; // reduces opponent goal chance
                    break;
                case 'save_penalty':
                case 'morale_penalty':
                    bonuses.defenseBonus += bonus; // negative bonus
                    break;
                case 'chaos_factor':
                    bonuses.chaosFactor += bonus;
                    break;
                case 'fear_factor':
                    bonuses.fearFactor += bonus;
                    break;
                case 'first_half_boost':
                    bonuses.firstHalf += bonus;
                    break;
                case 'second_half_boost':
                    bonuses.secondHalf += bonus;
                    break;
                case 'momentum_gain':
                    bonuses.momentumGain += bonus;
                    break;
                case 'momentum_resist':
                    bonuses.momentumResist += bonus;
                    break;
                case 'superstar':
                    bonuses.superstar = player;
                    bonuses.attackBonus += bonus * 0.5;
                    break;
                case 'all_round':
                    bonuses.attackBonus += bonus * 0.2;
                    bonuses.midfieldBonus += bonus * 0.2;
                    bonuses.defenseBonus += bonus * 0.2;
                    break;
                case 'set_piece':
                    bonuses.attackBonus += bonus * 0.3; // set pieces create more goals
                    break;
            }
        });

        return bonuses;
    }

    simulateMatch() {
        const homeStr = this.getTeamStrength(this.home, true);
        const awayStr = this.getTeamStrength(this.away, false);

        // Apply fear factor: reduce opponent strength
        if (this.homeTraitBonuses.fearFactor > 0) {
            awayStr.attack -= this.homeTraitBonuses.fearFactor * 0.2;
            awayStr.midfield -= this.homeTraitBonuses.fearFactor * 0.15;
        }
        if (this.awayTraitBonuses.fearFactor > 0) {
            homeStr.attack -= this.awayTraitBonuses.fearFactor * 0.2;
            homeStr.midfield -= this.awayTraitBonuses.fearFactor * 0.15;
        }

        // Possession based on midfield strength
        const midRatio = homeStr.midfield / (homeStr.midfield + awayStr.midfield);
        this.possession.home = Math.round(midRatio * 100);
        this.possession.away = 100 - this.possession.home;

        // Simulate minute by minute
        for (let min = 1; min <= 90; min++) {
            this.minute = min;
            this.simulateMinute(homeStr, awayStr, min);
        }

        // Extra time
        const extraTime = Math.floor(Math.random() * 4) + 1;
        for (let min = 91; min <= 90 + extraTime; min++) {
            this.minute = min;
            this.simulateMinute(homeStr, awayStr, min);
        }
        this.events.push({ minute: 90, type: 'extra_time', data: { minutes: extraTime } });

        return {
            homeScore: this.homeScore,
            awayScore: this.awayScore,
            events: this.events,
            possession: this.possession,
            stats: this.generateStats(homeStr, awayStr)
        };
    }

    simulateMinute(homeStr, awayStr, min) {
        // Chaos factor increases event frequency
        const chaosBonus = (this.homeTraitBonuses.chaosFactor + this.awayTraitBonuses.chaosFactor) * 0.1;
        const eventChance = 15 + chaosBonus;
        
        const rand = Math.random() * 100;
        if (rand > eventChance) return;

        // Half-time trait adjustments
        const isSecondHalf = min > 45;
        let homeAttMod = 0, awayAttMod = 0;
        if (!isSecondHalf) {
            homeAttMod = this.homeTraitBonuses.firstHalf * 0.3;
            awayAttMod = this.awayTraitBonuses.firstHalf * 0.3;
        } else {
            homeAttMod = this.homeTraitBonuses.secondHalf * 0.3;
            awayAttMod = this.awayTraitBonuses.secondHalf * 0.3;
        }

        // Adjusted strengths for this minute
        const adjHomeStr = {
            ...homeStr,
            attack: homeStr.attack + homeAttMod,
            midfield: homeStr.midfield + homeAttMod * 0.5
        };
        const adjAwayStr = {
            ...awayStr,
            attack: awayStr.attack + awayAttMod,
            midfield: awayStr.midfield + awayAttMod * 0.5
        };

        // Determine which team has the action
        const possessionBonus = this.possession.home - 50;
        const momentumMod = this.momentum * 0.3;
        const isHome = Math.random() * 100 < 50 + possessionBonus * 0.3 + momentumMod;
        
        const attacker = isHome ? this.home : this.away;
        const defender = isHome ? this.away : this.home;
        const attStr = isHome ? adjHomeStr : adjAwayStr;
        const defStr = isHome ? adjAwayStr : adjHomeStr;
        const attTraits = isHome ? this.homeTraitBonuses : this.awayTraitBonuses;
        const defTraits = isHome ? this.awayTraitBonuses : this.homeTraitBonuses;

        const eventRoll = Math.random() * 100;

        if (eventRoll < 28) {
            this.simulateShot(attacker, defender, attStr, defStr, attTraits, defTraits, min, isHome);
        } else if (eventRoll < 42) {
            this.simulateFoul(attacker, defender, min, isHome);
        } else if (eventRoll < 58) {
            this.events.push({
                minute: min,
                type: 'chance',
                team: isHome ? 'home' : 'away',
                data: { player: this.getRandomPlayer(attacker, 'midfield') }
            });
        } else if (eventRoll < 70) {
            // Momentum shift
            const gain = isHome 
                ? 10 + (attTraits.momentumGain || 0) * 0.3
                : -(10 + (attTraits.momentumGain || 0) * 0.3);
            const resist = isHome 
                ? this.awayTraitBonuses.momentumResist * 0.2 
                : this.homeTraitBonuses.momentumResist * 0.2;
            this.momentum += gain * (1 - resist / 100);
            this.momentum = Math.max(-60, Math.min(60, this.momentum));
        }
    }

    simulateShot(attacker, defender, attStr, defStr, attTraits, defTraits, min, isHome) {
        const shooter = this.getRandomPlayer(attacker, 'attack');
        
        // Base shot power from player stats
        let shotPower = shooter.stats.shooting * 0.5 + shooter.stats.morale * 0.2 + shooter.stats.pace * 0.15;
        
        // Trait: long shot bonus
        if (attTraits.longShot > 0 && Math.random() < 0.3) {
            shotPower += attTraits.longShot * 0.5;
        }

        // Trait: counter attack bonus (if opponent had possession last event)
        if (attTraits.counterAttack > 0 && this.momentum < 0 === isHome) {
            shotPower += attTraits.counterAttack * 0.3;
        }

        // Trait: superstar gets individual bonus
        if (attTraits.superstar && shooter.name === attTraits.superstar.name) {
            shotPower += 15;
        }

        // Defense power
        let defPower = defStr.defense;
        
        // Trait: defense clutch when losing
        if (defTraits.defenseBonus > 0) {
            const isLosing = isHome ? this.homeScore < this.awayScore : this.awayScore < this.homeScore;
            if (isLosing) defPower += 5; // Extra motivation when behind
        }

        // Goalkeeper save modifier
        const keeper = this.getGoalkeeper(defender);
        const keeperPower = (keeper.stats.defense * 0.6 + keeper.stats.physical * 0.4) + (defTraits.savePenalty || 0);

        // Calculate goal probability
        const goalChance = (shotPower / (shotPower + defPower + keeperPower * 0.5)) * 50;
        const onTarget = Math.random() * 100 < goalChance + 25;

        if (onTarget) {
            const saved = Math.random() * 100 > goalChance;
            if (!saved) {
                // GOAL!
                if (isHome) this.homeScore++;
                else this.awayScore++;

                const assister = this.getRandomPlayer(attacker, 'midfield');
                this.events.push({
                    minute: min,
                    type: 'goal',
                    team: isHome ? 'home' : 'away',
                    data: {
                        scorer: shooter,
                        assist: assister !== shooter ? assister : null,
                        description: this.generateGoalDescription(shooter, assister)
                    }
                });
                this.momentum = 0;
            } else {
                this.events.push({
                    minute: min,
                    type: 'save',
                    team: isHome ? 'home' : 'away',
                    data: { shooter, keeper }
                });
            }
        } else {
            this.events.push({
                minute: min,
                type: 'shot_wide',
                team: isHome ? 'home' : 'away',
                data: { shooter }
            });
        }
    }

    simulateFoul(attacker, defender, min, isHome) {
        const fouler = this.getRandomPlayer(defender, 'defense');
        const fouled = this.getRandomPlayer(attacker, 'attack');

        const severity = Math.random();
        let card = null;
        if (severity > 0.92) card = 'red';
        else if (severity > 0.75) card = 'yellow';

        this.events.push({
            minute: min,
            type: 'foul',
            team: isHome ? 'away' : 'home',
            data: { fouler, fouled, card }
        });
    }

    getRandomPlayer(team, zone) {
        const zonePlayers = team.players.filter(p => {
            const pos = p.pos;
            if (zone === 'attack') return ['ST', 'LW', 'RW', 'AM'].includes(pos);
            if (zone === 'midfield') return ['CM', 'LM', 'RM', 'AM'].includes(pos);
            if (zone === 'defense') return ['CB', 'LB', 'RB', 'GK'].includes(pos);
            return true;
        });
        if (zonePlayers.length === 0) return team.players[Math.floor(Math.random() * team.players.length)];
        
        // Weight selection by relevant stats
        const weights = zonePlayers.map(p => {
            if (zone === 'attack') return p.stats.shooting + p.stats.pace;
            if (zone === 'midfield') return p.stats.passing + p.stats.morale;
            return p.stats.defense + p.stats.physical;
        });
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let roll = Math.random() * totalWeight;
        for (let i = 0; i < zonePlayers.length; i++) {
            roll -= weights[i];
            if (roll <= 0) return zonePlayers[i];
        }
        return zonePlayers[0];
    }

    getGoalkeeper(team) {
        return team.players.find(p => p.pos === 'GK') || team.players[0];
    }

    generateGoalDescription(scorer, assister) {
        const descriptions = [
            `${scorer.name} strikes with the fury of a thousand warriors!`,
            `A thunderous shot from ${scorer.name} finds the net!`,
            `${scorer.name} channels the spirit of battle — GOAL!`,
            `Like an arrow from the heavens, ${scorer.name} scores!`,
            `${scorer.name} breaks through like a cavalry charge!`,
            `The crowd roars as ${scorer.name} claims glory!`,
            `With cunning precision, ${scorer.name} finds the corner!`,
            `${scorer.name} unleashes a strike worthy of legend!`,
        ];
        return descriptions[Math.floor(Math.random() * descriptions.length)];
    }

    generateStats(homeStr, awayStr) {
        const homeShots = this.events.filter(e =>
            ['goal', 'save', 'shot_wide'].includes(e.type) && e.team === 'home'
        ).length;
        const awayShots = this.events.filter(e =>
            ['goal', 'save', 'shot_wide'].includes(e.type) && e.team === 'away'
        ).length;

        return {
            shots: { home: homeShots || 3, away: awayShots || 3 },
            possession: this.possession,
            fouls: {
                home: this.events.filter(e => e.type === 'foul' && e.team === 'home').length,
                away: this.events.filter(e => e.type === 'foul' && e.team === 'away').length
            },
            formationFit: {
                home: homeStr.formationFit,
                away: awayStr.formationFit
            }
        };
    }
}
