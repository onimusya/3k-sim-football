// Game State Manager
// Handles season progression, economy, events, and persistence

import { KINGDOMS, generatePlayers } from '../data/teams.js';

// Random events that fire between matches
const RANDOM_EVENTS = [
    {
        id: 'injury',
        title: '⚠️ Training Injury',
        getText: (player) => `${player.name} pulled a muscle during drills. They will miss the next match!`,
        effect: (gameState, player) => { player.injured = true; },
        weight: 15,
    },
    {
        id: 'morale_crisis',
        title: '😤 Morale Crisis',
        getText: (player) => `${player.name} is unhappy with their position. Morale dropped!`,
        effect: (gameState, player) => { player.stats.morale = Math.max(30, player.stats.morale - 10); },
        weight: 12,
    },
    {
        id: 'rival_poach',
        title: '🔄 Rival Interest',
        getText: (player) => `A rival kingdom is trying to poach ${player.name}! Pay 300 gold to keep them, or lose them.`,
        effect: (gameState, player) => { gameState.pendingEvent = { type: 'poach', player }; },
        weight: 8,
        requiresDecision: true,
    },
    {
        id: 'sponsor',
        title: '💰 Sponsor Offer',
        getText: () => `A local merchant offers 200 gold if you win your next match!`,
        effect: (gameState) => { gameState.sponsorBonus = 200; },
        weight: 15,
    },
    {
        id: 'breakthrough',
        title: '⭐ Training Breakthrough',
        getText: (player) => `${player.name} had an incredible training session! All stats +3!`,
        effect: (gameState, player) => {
            Object.keys(player.stats).forEach(k => {
                player.stats[k] = Math.min(99, player.stats[k] + 3);
            });
        },
        weight: 8,
    },
    {
        id: 'morale_boost',
        title: '🎉 Team Celebration',
        getText: () => `The warriors held a feast! Team morale boosted!`,
        effect: (gameState) => {
            gameState.players.forEach(p => {
                p.stats.morale = Math.min(99, p.stats.morale + 5);
            });
        },
        weight: 12,
    },
    {
        id: 'scout_report',
        title: '🔍 Scout Report',
        getText: () => `Your scouts report the next opponent's weakness. Formation fit bonus next match!`,
        effect: (gameState) => { gameState.scoutBonus = true; },
        weight: 10,
    },
    {
        id: 'challenge_match',
        title: '⚔️ Challenge Match',
        getText: () => `Lü Bu's mercenaries challenge you to an exhibition! Win for 500 gold!`,
        effect: (gameState) => { gameState.challengeMatch = true; },
        weight: 6,
        requiresDecision: true,
    },
    {
        id: 'weather',
        title: '🌧️ Heavy Rain',
        getText: () => `Heavy rain forecast for match day. Pace stats will be reduced for all players.`,
        effect: (gameState) => { gameState.weatherPenalty = 'rain'; },
        weight: 10,
    },
    {
        id: 'recovery',
        title: '💪 Full Recovery',
        getText: (player) => `${player.name} has recovered from their injury and is ready to play!`,
        effect: (gameState, player) => { player.injured = false; },
        weight: 10,
        requiresInjured: true,
    },
];

export class GameStateManager {
    static SEASON_LENGTH = 10; // 10 weeks per season
    static WEEKLY_INCOME_BASE = 150;
    static WAGE_PER_PLAYER = 20;

    static initializeState(registry) {
        const state = registry.get('gameState');
        if (!state.initialized) {
            state.initialized = true;
            state.money = 1500;
            state.reputation = 50;
            state.facilities = {
                trainingGround: 1, // level 1-3
                medicalTent: 0,
                scoutNetwork: 0,
            };
            state.seasonGoal = null;
            state.trophies = [];
            state.sponsorBonus = 0;
            state.scoutBonus = false;
            state.weatherPenalty = null;
            state.challengeMatch = false;
            state.pendingEvent = null;
            state.lastEvent = null;
            state.matchesThisSeason = 0;
            state.seasonComplete = false;
            registry.set('gameState', state);
        }
        return state;
    }

    static advanceWeek(registry) {
        const state = registry.get('gameState');
        state.week++;
        state.matchesThisSeason = (state.matchesThisSeason || 0) + 1;

        // Weekly economy
        const income = this.calculateIncome(state);
        const wages = this.calculateWages(state);
        state.money += income - wages;

        // Prevent negative money crisis
        if (state.money < 0) {
            state.money = 0;
            // Worst player loses morale significantly
            if (state.players && state.players.length > 0) {
                const weakest = [...state.players].sort((a, b) => {
                    const aOvr = Object.values(a.stats).reduce((s, v) => s + v, 0);
                    const bOvr = Object.values(b.stats).reduce((s, v) => s + v, 0);
                    return aOvr - bOvr;
                })[0];
                weakest.stats.morale = Math.max(20, weakest.stats.morale - 15);
            }
        }

        // Check season end
        if (state.matchesThisSeason >= this.SEASON_LENGTH) {
            state.seasonComplete = true;
        }

        // Clear one-time effects
        state.scoutBonus = false;
        state.weatherPenalty = null;
        state.challengeMatch = false;

        // Heal injured players (50% chance per week)
        if (state.players) {
            state.players.forEach(p => {
                if (p.injured && Math.random() > 0.5) {
                    p.injured = false;
                }
            });
        }

        // Collect sponsor bonus if won
        if (state.sponsorBonus > 0 && state.lastMatchWon) {
            state.money += state.sponsorBonus;
            state.sponsorBonus = 0;
        }
        state.lastMatchWon = false;

        registry.set('gameState', state);
        return state;
    }

    static calculateIncome(state) {
        const positionBonus = Math.max(0, (7 - this.getLeaguePosition(state)) * 30);
        const reputationBonus = Math.floor(state.reputation * 0.5);
        return this.WEEKLY_INCOME_BASE + positionBonus + reputationBonus;
    }

    static calculateWages(state) {
        const playerCount = state.players ? state.players.length : 11;
        return playerCount * this.WAGE_PER_PLAYER;
    }

    static getLeaguePosition(state) {
        // Simple estimate based on win ratio
        const results = state.results || [];
        if (results.length === 0) return 3;
        const playerResults = results.filter(r => r.home === state.playerKingdom || r.away === state.playerKingdom);
        const wins = playerResults.filter(r => {
            if (r.home === state.playerKingdom) return r.homeScore > r.awayScore;
            return r.awayScore > r.homeScore;
        }).length;
        const winRate = wins / Math.max(1, playerResults.length);
        if (winRate >= 0.7) return 1;
        if (winRate >= 0.5) return 2;
        if (winRate >= 0.3) return 4;
        return 5;
    }

    static rollRandomEvent(state) {
        // 60% chance of an event each week
        if (Math.random() > 0.6) return null;

        const players = state.players || [];
        if (players.length === 0) return null;

        // Filter applicable events
        let available = RANDOM_EVENTS.filter(e => {
            if (e.requiresInjured) {
                return players.some(p => p.injured);
            }
            return true;
        });

        // Weighted selection
        const totalWeight = available.reduce((s, e) => s + e.weight, 0);
        let roll = Math.random() * totalWeight;
        let selected = available[0];
        for (const event of available) {
            roll -= event.weight;
            if (roll <= 0) { selected = event; break; }
        }

        // Pick a relevant player
        let targetPlayer;
        if (selected.requiresInjured) {
            targetPlayer = players.find(p => p.injured);
        } else {
            targetPlayer = players[Math.floor(Math.random() * players.length)];
        }

        // Apply non-decision events immediately
        if (!selected.requiresDecision) {
            selected.effect(state, targetPlayer);
        }

        const eventData = {
            id: selected.id,
            title: selected.title,
            text: selected.getText(targetPlayer),
            requiresDecision: selected.requiresDecision || false,
            player: targetPlayer,
        };

        state.lastEvent = eventData;
        return eventData;
    }

    static endSeason(registry) {
        const state = registry.get('gameState');
        const position = this.getLeaguePosition(state);

        // Season rewards
        const rewards = {
            gold: 0,
            reputation: 0,
            trophy: null,
        };

        if (position === 1) {
            rewards.gold = 1000;
            rewards.reputation = 20;
            rewards.trophy = `Season ${state.season} Champion`;
            state.trophies.push(rewards.trophy);
        } else if (position === 2) {
            rewards.gold = 500;
            rewards.reputation = 10;
        } else if (position <= 4) {
            rewards.gold = 200;
            rewards.reputation = 5;
        }

        state.money += rewards.gold;
        state.reputation = Math.min(100, state.reputation + rewards.reputation);

        // Natural stat decay for balance (aging)
        if (state.players) {
            state.players.forEach(p => {
                // Small random decay on 1-2 stats
                const stats = Object.keys(p.stats);
                const decayStat = stats[Math.floor(Math.random() * stats.length)];
                p.stats[decayStat] = Math.max(30, p.stats[decayStat] - Math.floor(Math.random() * 3));
            });
        }

        // Advance to next season
        state.season++;
        state.week = 1;
        state.matchesThisSeason = 0;
        state.seasonComplete = false;
        state.results = []; // Fresh season

        registry.set('gameState', state);
        return rewards;
    }

    // Facility upgrades
    static upgradeFacility(registry, facilityKey) {
        const state = registry.get('gameState');
        const currentLevel = state.facilities[facilityKey] || 0;
        if (currentLevel >= 3) return { success: false, reason: 'Max level' };

        const costs = { 0: 500, 1: 1000, 2: 2000 };
        const cost = costs[currentLevel];
        if (state.money < cost) return { success: false, reason: 'Not enough gold' };

        state.money -= cost;
        state.facilities[facilityKey] = currentLevel + 1;
        registry.set('gameState', state);

        return { success: true, newLevel: currentLevel + 1, cost };
    }

    // Get facility benefits
    static getFacilityBenefits(state) {
        const benefits = {
            trainingBoost: state.facilities.trainingGround || 1, // multiplier for training gains
            injuryReduction: (state.facilities.medicalTent || 0) * 0.2, // 0-60% injury reduction
            recruitDiscount: (state.facilities.scoutNetwork || 0) * 0.15, // 0-45% cheaper recruits
        };
        return benefits;
    }
}
