// Romance of the Three Kingdoms - Soccer Teams Data
// Each kingdom fields a team with warriors as players

export const KINGDOMS = {
    WEI: {
        id: 'wei',
        name: '魏 Wei',
        fullName: 'Kingdom of Wei',
        motto: 'Order Through Strength',
        color: 0x1a4d8f,
        colorHex: '#1a4d8f',
        accentColor: 0x3a7fd5,
        formation: '4-3-3',
        style: 'tactical', // Cao Cao's cunning
    },
    SHU: {
        id: 'shu',
        name: '蜀 Shu',
        fullName: 'Kingdom of Shu',
        motto: 'Virtue and Brotherhood',
        color: 0x8b1a1a,
        colorHex: '#8b1a1a',
        accentColor: 0xd44444,
        formation: '3-5-2',
        style: 'balanced', // Liu Bei's virtue
    },
    WU: {
        id: 'wu',
        name: '吳 Wu',
        fullName: 'Kingdom of Wu',
        motto: 'Swift as the River',
        color: 0x1a6b3a,
        colorHex: '#1a6b3a',
        accentColor: 0x33cc66,
        formation: '4-4-2',
        style: 'aggressive', // Sun family's fire
    },
    DONG: {
        id: 'dong',
        name: '董 Dong',
        fullName: 'Dong Zhuo Coalition',
        motto: 'Power Is All',
        color: 0x4a1a4a,
        colorHex: '#4a1a4a',
        accentColor: 0x9933cc,
        formation: '5-3-2',
        style: 'defensive',
    },
    YUAN: {
        id: 'yuan',
        name: '袁 Yuan',
        fullName: 'Yuan Shao Alliance',
        motto: 'Noble Blood Prevails',
        color: 0x8b7d1a,
        colorHex: '#8b7d1a',
        accentColor: 0xccaa33,
        formation: '4-4-2',
        style: 'possession',
    },
    LU: {
        id: 'lu',
        name: '呂 Lü',
        fullName: 'Lü Bu Mercenaries',
        motto: 'Unmatched Under Heaven',
        color: 0x6b1a1a,
        colorHex: '#6b1a1a',
        accentColor: 0xff4444,
        formation: '3-4-3',
        style: 'counter-attack',
    }
};

export const POSITIONS = {
    GK: { name: 'Goalkeeper', abbr: 'GK', zone: 'defense' },
    CB: { name: 'Center Back', abbr: 'CB', zone: 'defense' },
    LB: { name: 'Left Back', abbr: 'LB', zone: 'defense' },
    RB: { name: 'Right Back', abbr: 'RB', zone: 'defense' },
    CM: { name: 'Central Mid', abbr: 'CM', zone: 'midfield' },
    LM: { name: 'Left Mid', abbr: 'LM', zone: 'midfield' },
    RM: { name: 'Right Mid', abbr: 'RM', zone: 'midfield' },
    AM: { name: 'Attacking Mid', abbr: 'AM', zone: 'midfield' },
    ST: { name: 'Striker', abbr: 'ST', zone: 'attack' },
    LW: { name: 'Left Wing', abbr: 'LW', zone: 'attack' },
    RW: { name: 'Right Wing', abbr: 'RW', zone: 'attack' },
};

// Generate players for each kingdom based on historical figures
export function generatePlayers(kingdomId) {
    const rosters = {
        wei: [
            { name: 'Cao Cao', nameZh: '曹操', pos: 'AM', stats: { pace: 70, shooting: 82, passing: 95, defense: 60, physical: 72, morale: 99 }, trait: 'Strategist' },
            { name: 'Xiahou Dun', nameZh: '夏侯惇', pos: 'CB', stats: { pace: 75, shooting: 55, passing: 60, defense: 92, physical: 95, morale: 90 }, trait: 'Iron Will' },
            { name: 'Dian Wei', nameZh: '典韋', pos: 'ST', stats: { pace: 80, shooting: 88, passing: 50, defense: 65, physical: 98, morale: 85 }, trait: 'Berserker' },
            { name: 'Xu Chu', nameZh: '許褚', pos: 'CB', stats: { pace: 65, shooting: 60, passing: 45, defense: 90, physical: 97, morale: 88 }, trait: 'Tiger Guard' },
            { name: 'Zhang Liao', nameZh: '張遼', pos: 'RW', stats: { pace: 90, shooting: 80, passing: 72, defense: 70, physical: 82, morale: 92 }, trait: 'Lightning Raid' },
            { name: 'Xu Huang', nameZh: '徐晃', pos: 'LB', stats: { pace: 78, shooting: 60, passing: 65, defense: 85, physical: 88, morale: 80 }, trait: 'Axe Master' },
            { name: 'Zhang He', nameZh: '張郃', pos: 'RM', stats: { pace: 88, shooting: 70, passing: 75, defense: 72, physical: 75, morale: 78 }, trait: 'Graceful' },
            { name: 'Cao Ren', nameZh: '曹仁', pos: 'RB', stats: { pace: 70, shooting: 55, passing: 68, defense: 88, physical: 85, morale: 82 }, trait: 'Fortress' },
            { name: 'Guo Jia', nameZh: '郭嘉', pos: 'CM', stats: { pace: 65, shooting: 60, passing: 92, defense: 55, physical: 50, morale: 90 }, trait: 'Oracle' },
            { name: 'Sima Yi', nameZh: '司馬懿', pos: 'CM', stats: { pace: 60, shooting: 65, passing: 90, defense: 70, physical: 55, morale: 85 }, trait: 'Patience' },
            { name: 'Cao Pi', nameZh: '曹丕', pos: 'GK', stats: { pace: 65, shooting: 50, passing: 70, defense: 82, physical: 70, morale: 75 }, trait: 'Heir' },
        ],
        shu: [
            { name: 'Liu Bei', nameZh: '劉備', pos: 'CM', stats: { pace: 68, shooting: 65, passing: 90, defense: 60, physical: 65, morale: 99 }, trait: 'Benevolence' },
            { name: 'Guan Yu', nameZh: '關羽', pos: 'CB', stats: { pace: 72, shooting: 75, passing: 70, defense: 95, physical: 92, morale: 98 }, trait: 'God of War' },
            { name: 'Zhang Fei', nameZh: '張飛', pos: 'ST', stats: { pace: 85, shooting: 90, passing: 55, defense: 60, physical: 96, morale: 88 }, trait: 'Thunderbolt' },
            { name: 'Zhao Yun', nameZh: '趙雲', pos: 'RW', stats: { pace: 95, shooting: 85, passing: 78, defense: 80, physical: 88, morale: 95 }, trait: 'Dragon' },
            { name: 'Zhuge Liang', nameZh: '諸葛亮', pos: 'AM', stats: { pace: 55, shooting: 70, passing: 99, defense: 65, physical: 45, morale: 95 }, trait: 'Sleeping Dragon' },
            { name: 'Ma Chao', nameZh: '馬超', pos: 'LW', stats: { pace: 92, shooting: 82, passing: 65, defense: 70, physical: 90, morale: 80 }, trait: 'Splendor' },
            { name: 'Huang Zhong', nameZh: '黃忠', pos: 'ST', stats: { pace: 65, shooting: 95, passing: 60, defense: 55, physical: 80, morale: 85 }, trait: 'Veteran Archer' },
            { name: 'Wei Yan', nameZh: '魏延', pos: 'LB', stats: { pace: 80, shooting: 70, passing: 60, defense: 82, physical: 88, morale: 65 }, trait: 'Rebel Spirit' },
            { name: 'Jiang Wei', nameZh: '姜維', pos: 'RM', stats: { pace: 82, shooting: 75, passing: 80, defense: 75, physical: 78, morale: 88 }, trait: 'Heir of Stars' },
            { name: 'Pang Tong', nameZh: '龐統', pos: 'CM', stats: { pace: 58, shooting: 60, passing: 88, defense: 60, physical: 50, morale: 78 }, trait: 'Phoenix' },
            { name: 'Fa Zheng', nameZh: '法正', pos: 'GK', stats: { pace: 62, shooting: 50, passing: 75, defense: 80, physical: 65, morale: 80 }, trait: 'Sharp Mind' },
        ],
        wu: [
            { name: 'Sun Jian', nameZh: '孫堅', pos: 'ST', stats: { pace: 85, shooting: 88, passing: 70, defense: 72, physical: 90, morale: 92 }, trait: 'Tiger of Jiang Dong' },
            { name: 'Sun Ce', nameZh: '孫策', pos: 'RW', stats: { pace: 92, shooting: 85, passing: 75, defense: 65, physical: 88, morale: 95 }, trait: 'Little Conqueror' },
            { name: 'Sun Quan', nameZh: '孫權', pos: 'CM', stats: { pace: 70, shooting: 68, passing: 85, defense: 70, physical: 72, morale: 90 }, trait: 'Ruler' },
            { name: 'Zhou Yu', nameZh: '周瑜', pos: 'AM', stats: { pace: 75, shooting: 78, passing: 92, defense: 60, physical: 65, morale: 88 }, trait: 'Fire Tactician' },
            { name: 'Lu Xun', nameZh: '陸遜', pos: 'LM', stats: { pace: 82, shooting: 72, passing: 88, defense: 68, physical: 65, morale: 85 }, trait: 'Young Genius' },
            { name: 'Gan Ning', nameZh: '甘寧', pos: 'LW', stats: { pace: 90, shooting: 82, passing: 60, defense: 65, physical: 85, morale: 80 }, trait: 'Pirate King' },
            { name: 'Taishi Ci', nameZh: '太史慈', pos: 'CB', stats: { pace: 80, shooting: 75, passing: 65, defense: 88, physical: 90, morale: 85 }, trait: 'Loyal Archer' },
            { name: 'Huang Gai', nameZh: '黃蓋', pos: 'CB', stats: { pace: 60, shooting: 55, passing: 60, defense: 90, physical: 92, morale: 90 }, trait: 'Fire Ship' },
            { name: 'Lu Meng', nameZh: '呂蒙', pos: 'RB', stats: { pace: 78, shooting: 65, passing: 72, defense: 85, physical: 80, morale: 82 }, trait: 'Scholar General' },
            { name: 'Ding Feng', nameZh: '丁奉', pos: 'LB', stats: { pace: 75, shooting: 60, passing: 65, defense: 82, physical: 85, morale: 78 }, trait: 'Snow Warrior' },
            { name: 'Zhou Tai', nameZh: '周泰', pos: 'GK', stats: { pace: 70, shooting: 50, passing: 60, defense: 92, physical: 95, morale: 88 }, trait: 'Scarred Guardian' },
        ],
        dong: [
            { name: 'Dong Zhuo', nameZh: '董卓', pos: 'CM', stats: { pace: 40, shooting: 55, passing: 70, defense: 60, physical: 80, morale: 75 }, trait: 'Tyrant' },
            { name: 'Li Jue', nameZh: '李傕', pos: 'ST', stats: { pace: 78, shooting: 75, passing: 55, defense: 60, physical: 82, morale: 65 }, trait: 'Raider' },
            { name: 'Guo Si', nameZh: '郭汜', pos: 'ST', stats: { pace: 75, shooting: 72, passing: 50, defense: 58, physical: 80, morale: 60 }, trait: 'Cutthroat' },
            { name: 'Hua Xiong', nameZh: '華雄', pos: 'CB', stats: { pace: 70, shooting: 60, passing: 45, defense: 85, physical: 92, morale: 70 }, trait: 'Gate Breaker' },
            { name: 'Li Ru', nameZh: '李儒', pos: 'AM', stats: { pace: 55, shooting: 60, passing: 82, defense: 50, physical: 45, morale: 72 }, trait: 'Dark Counsel' },
            { name: 'Zhang Ji', nameZh: '張濟', pos: 'RM', stats: { pace: 72, shooting: 65, passing: 60, defense: 70, physical: 75, morale: 65 }, trait: 'Nomad' },
            { name: 'Fan Chou', nameZh: '樊稠', pos: 'LM', stats: { pace: 74, shooting: 68, passing: 58, defense: 68, physical: 78, morale: 62 }, trait: 'Horseman' },
            { name: 'Niu Fu', nameZh: '牛輔', pos: 'CB', stats: { pace: 65, shooting: 50, passing: 55, defense: 82, physical: 85, morale: 60 }, trait: 'Loyal Brute' },
            { name: 'Xu Rong', nameZh: '徐榮', pos: 'RB', stats: { pace: 72, shooting: 60, passing: 62, defense: 80, physical: 78, morale: 68 }, trait: 'Ambusher' },
            { name: 'Jia Xu', nameZh: '賈詡', pos: 'LB', stats: { pace: 58, shooting: 55, passing: 85, defense: 72, physical: 50, morale: 80 }, trait: 'Poisoned Mind' },
            { name: 'Chen Gong', nameZh: '陳宮', pos: 'GK', stats: { pace: 60, shooting: 45, passing: 78, defense: 75, physical: 60, morale: 82 }, trait: 'Loyalist' },
        ],
        yuan: [
            { name: 'Yuan Shao', nameZh: '袁紹', pos: 'CM', stats: { pace: 60, shooting: 62, passing: 80, defense: 65, physical: 68, morale: 78 }, trait: 'Noble Birth' },
            { name: 'Yuan Shu', nameZh: '袁術', pos: 'AM', stats: { pace: 58, shooting: 65, passing: 72, defense: 55, physical: 60, morale: 65 }, trait: 'False Emperor' },
            { name: 'Yan Liang', nameZh: '顏良', pos: 'ST', stats: { pace: 82, shooting: 85, passing: 55, defense: 65, physical: 90, morale: 75 }, trait: 'Vanguard' },
            { name: 'Wen Chou', nameZh: '文醜', pos: 'ST', stats: { pace: 80, shooting: 82, passing: 52, defense: 62, physical: 88, morale: 72 }, trait: 'Fearless' },
            { name: 'Zhang He', nameZh: '張郃', pos: 'RW', stats: { pace: 85, shooting: 70, passing: 72, defense: 70, physical: 75, morale: 78 }, trait: 'Graceful' },
            { name: 'Gao Lan', nameZh: '高覽', pos: 'CB', stats: { pace: 72, shooting: 58, passing: 60, defense: 85, physical: 82, morale: 70 }, trait: 'Stalwart' },
            { name: 'Ju Shou', nameZh: '沮授', pos: 'CM', stats: { pace: 55, shooting: 55, passing: 85, defense: 60, physical: 50, morale: 82 }, trait: 'Ignored Counsel' },
            { name: 'Tian Feng', nameZh: '田豐', pos: 'LM', stats: { pace: 58, shooting: 52, passing: 82, defense: 58, physical: 48, morale: 78 }, trait: 'Unheeded' },
            { name: 'Chunyu Qiong', nameZh: '淳于瓊', pos: 'GK', stats: { pace: 55, shooting: 45, passing: 55, defense: 78, physical: 80, morale: 50 }, trait: 'Drunkard' },
            { name: 'Feng Ji', nameZh: '逢紀', pos: 'LB', stats: { pace: 60, shooting: 50, passing: 72, defense: 70, physical: 55, morale: 65 }, trait: 'Schemer' },
            { name: 'Shen Pei', nameZh: '審配', pos: 'RB', stats: { pace: 62, shooting: 52, passing: 68, defense: 80, physical: 72, morale: 85 }, trait: 'Defender of Ye' },
        ],
        lu: [
            { name: 'Lü Bu', nameZh: '呂布', pos: 'ST', stats: { pace: 97, shooting: 95, passing: 60, defense: 75, physical: 99, morale: 60 }, trait: 'Unrivaled' },
            { name: 'Chen Gong', nameZh: '陳宮', pos: 'AM', stats: { pace: 58, shooting: 60, passing: 88, defense: 55, physical: 50, morale: 85 }, trait: 'Loyal Advisor' },
            { name: 'Gao Shun', nameZh: '高順', pos: 'CB', stats: { pace: 72, shooting: 65, passing: 60, defense: 90, physical: 88, morale: 92 }, trait: 'Camp Breaker' },
            { name: 'Zhang Liao', nameZh: '張遼', pos: 'RM', stats: { pace: 88, shooting: 78, passing: 70, defense: 72, physical: 82, morale: 85 }, trait: 'Defector' },
            { name: 'Zang Ba', nameZh: '臧霸', pos: 'RW', stats: { pace: 82, shooting: 75, passing: 62, defense: 68, physical: 80, morale: 72 }, trait: 'Bandit King' },
            { name: 'Hou Cheng', nameZh: '侯成', pos: 'LB', stats: { pace: 70, shooting: 55, passing: 55, defense: 75, physical: 78, morale: 50 }, trait: 'Traitor' },
            { name: 'Song Xian', nameZh: '宋憲', pos: 'CB', stats: { pace: 68, shooting: 52, passing: 50, defense: 78, physical: 80, morale: 48 }, trait: 'Opportunist' },
            { name: 'Wei Xu', nameZh: '魏續', pos: 'RB', stats: { pace: 70, shooting: 55, passing: 52, defense: 76, physical: 78, morale: 45 }, trait: 'Turncoat' },
            { name: 'Diao Chan', nameZh: '貂蟬', pos: 'LW', stats: { pace: 85, shooting: 72, passing: 80, defense: 45, physical: 50, morale: 70 }, trait: 'Enchantress' },
            { name: 'Cao Xing', nameZh: '曹性', pos: 'LM', stats: { pace: 75, shooting: 80, passing: 58, defense: 60, physical: 70, morale: 65 }, trait: 'Eye Shot' },
            { name: 'Qin Yi', nameZh: '秦宜', pos: 'GK', stats: { pace: 62, shooting: 48, passing: 55, defense: 80, physical: 82, morale: 60 }, trait: 'Unknown Hero' },
        ],
    };

    return rosters[kingdomId] || rosters.wei;
}

export function getTeamOverall(players) {
    if (!players || players.length === 0) return 0;
    const total = players.reduce((sum, p) => {
        const s = p.stats;
        return sum + (s.pace + s.shooting + s.passing + s.defense + s.physical + s.morale) / 6;
    }, 0);
    return Math.round(total / players.length);
}
