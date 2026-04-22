/**
 * Gamified Learning Progress Tracker for SQL Optimization Skills
 */

class SQLGameification {
    constructor() {
        this.userProgress = this.loadProgress();
        this.achievements = this.initializeAchievements();
        this.skillCategories = this.initializeSkillCategories();
        this.init();
    }

    init() {
        this.createProgressPanel();
        this.setupEventListeners();
        this.updateProgressDisplay();
    }

    loadProgress() {
        const saved = localStorage.getItem('sqlOptimizationProgress');
        return saved ? JSON.parse(saved) : {
            totalPoints: 0,
            level: 1,
            experience: 0,
            experienceToNext: 100,
            queriesAnalyzed: 0,
            optimizationsApplied: 0,
            performanceTestsRun: 0,
            skillPoints: {
                oracle: 0,
                sqlserver: 0,
                postgresql: 0,
                performance: 0,
                migration: 0
            },
            achievements: [],
            badges: [],
            streakDays: 0,
            lastActiveDate: null
        };
    }

    saveProgress() {
        localStorage.setItem('sqlOptimizationProgress', JSON.stringify(this.userProgress));
    }

    initializeAchievements() {
        return [
            {
                id: 'first_analysis',
                title: 'First Steps',
                description: 'Analyze your first SQL query',
                icon: '🚀',
                points: 10,
                condition: (progress) => progress.queriesAnalyzed >= 1
            },
            {
                id: 'oracle_specialist',
                title: 'Oracle Specialist',
                description: 'Complete 10 Oracle to PostgreSQL conversions',
                icon: '🔮',
                points: 50,
                condition: (progress) => progress.skillPoints.oracle >= 100
            },
            {
                id: 'sql_server_expert',
                title: 'SQL Server Expert',
                description: 'Master SQL Server to PostgreSQL migration',
                icon: '🛠️',
                points: 50,
                condition: (progress) => progress.skillPoints.sqlserver >= 100
            },
            {
                id: 'performance_guru',
                title: 'Performance Guru',
                description: 'Run 5 performance comparison tests',
                icon: '⚡',
                points: 75,
                condition: (progress) => progress.performanceTestsRun >= 5
            },
            {
                id: 'optimization_master',
                title: 'Optimization Master',
                description: 'Apply 25 SQL optimizations',
                icon: '🎯',
                points: 100,
                condition: (progress) => progress.optimizationsApplied >= 25
            },
            {
                id: 'streak_warrior',
                title: 'Streak Warrior',
                description: 'Use the tool for 7 consecutive days',
                icon: '🔥',
                points: 150,
                condition: (progress) => progress.streakDays >= 7
            },
            {
                id: 'migration_champion',
                title: 'Migration Champion',
                description: 'Reach Level 10 in SQL migration skills',
                icon: '👑',
                points: 200,
                condition: (progress) => progress.level >= 10
            }
        ];
    }

    initializeSkillCategories() {
        return {
            oracle: {
                name: 'Oracle Migration',
                color: '#FF6B35',
                skills: ['PL/SQL Conversion', 'Data Type Mapping', 'Function Translation']
            },
            sqlserver: {
                name: 'SQL Server Migration',
                color: '#4ECDC4',
                skills: ['T-SQL Conversion', 'Stored Procedures', 'Error Handling']
            },
            postgresql: {
                name: 'PostgreSQL Expertise',
                color: '#45B7D1',
                skills: ['PL/pgSQL', 'Aurora Features', 'Query Optimization']
            },
            performance: {
                name: 'Performance Tuning',
                color: '#96CEB4',
                skills: ['Index Optimization', 'Query Analysis', 'Execution Plans']
            },
            migration: {
                name: 'Migration Strategy',
                color: '#FFEAA7',
                skills: ['Planning', 'Best Practices', 'Troubleshooting']
            }
        };
    }

    createProgressPanel() {
        const progressHTML = `
            <div id="gamification-panel" class="gamification-panel collapsed">
                <div class="gamification-header">
                    <button class="gamification-toggle" id="gamification-toggle">
                        <i class="fas fa-trophy"></i>
                        <span class="level-indicator">Lvl ${this.userProgress.level}</span>
                    </button>
                </div>
                <div class="gamification-content">
                    <div class="progress-overview">
                        <div class="user-level">
                            <h4>Level ${this.userProgress.level} SQL Optimizer</h4>
                            <div class="experience-bar">
                                <div class="experience-fill" style="width: ${(this.userProgress.experience / this.userProgress.experienceToNext) * 100}%"></div>
                            </div>
                            <small>${this.userProgress.experience}/${this.userProgress.experienceToNext} XP</small>
                        </div>
                        
                        <div class="stats-grid">
                            <div class="stat-item">
                                <span class="stat-number">${this.userProgress.totalPoints}</span>
                                <span class="stat-label">Total Points</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number">${this.userProgress.queriesAnalyzed}</span>
                                <span class="stat-label">Queries Analyzed</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number">${this.userProgress.optimizationsApplied}</span>
                                <span class="stat-label">Optimizations</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number">${this.userProgress.performanceTestsRun}</span>
                                <span class="stat-label">Performance Tests</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="skills-section">
                        <h5>Skill Progress</h5>
                        <div class="skills-grid" id="skills-grid">
                            <!-- Skills will be populated here -->
                        </div>
                    </div>
                    
                    <div class="achievements-section">
                        <h5>Achievements</h5>
                        <div class="achievements-grid" id="achievements-grid">
                            <!-- Achievements will be populated here -->
                        </div>
                    </div>
                    
                    <div class="daily-challenge">
                        <h5>Daily Challenge</h5>
                        <div class="challenge-card" id="daily-challenge">
                            <!-- Daily challenge will be populated here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', progressHTML);
    }

    setupEventListeners() {
        const toggle = document.getElementById('gamification-toggle');
        const panel = document.getElementById('gamification-panel');

        toggle.addEventListener('click', () => {
            panel.classList.toggle('collapsed');
        });

        // Listen for application events
        this.setupGameEventListeners();
    }

    setupGameEventListeners() {
        // Listen for query analysis events
        document.addEventListener('sqlQueryAnalyzed', (event) => {
            this.onQueryAnalyzed(event.detail);
        });

        // Listen for optimization events
        document.addEventListener('sqlOptimizationApplied', (event) => {
            this.onOptimizationApplied(event.detail);
        });

        // Listen for performance test events
        document.addEventListener('performanceTestCompleted', (event) => {
            this.onPerformanceTestCompleted(event.detail);
        });

        // Listen for download events
        document.addEventListener('sqlDownloaded', (event) => {
            this.onSqlDownloaded(event.detail);
        });
    }

    onQueryAnalyzed(details) {
        this.userProgress.queriesAnalyzed++;
        this.addExperience(10);
        
        // Award skill points based on source type
        if (details.sourceType === 'oracle') {
            this.addSkillPoints('oracle', 10);
        } else if (details.sourceType === 'sqlserver') {
            this.addSkillPoints('sqlserver', 10);
        }
        
        this.addSkillPoints('postgresql', 5);
        
        this.checkAchievements();
        this.updateProgressDisplay();
        this.saveProgress();
        
        this.showPointsEarned(10, 'Query Analyzed!');
    }

    onOptimizationApplied(details) {
        this.userProgress.optimizationsApplied++;
        this.addExperience(25);
        this.addSkillPoints('performance', 15);
        
        this.checkAchievements();
        this.updateProgressDisplay();
        this.saveProgress();
        
        this.showPointsEarned(25, 'Optimization Applied!');
    }

    onPerformanceTestCompleted(details) {
        this.userProgress.performanceTestsRun++;
        this.addExperience(50);
        this.addSkillPoints('performance', 25);
        this.addSkillPoints('migration', 10);
        
        this.checkAchievements();
        this.updateProgressDisplay();
        this.saveProgress();
        
        this.showPointsEarned(50, 'Performance Test Completed!');
    }

    onSqlDownloaded(details) {
        this.addExperience(5);
        this.addSkillPoints('migration', 5);
        
        this.updateProgressDisplay();
        this.saveProgress();
        
        this.showPointsEarned(5, 'SQL Downloaded!');
    }

    addExperience(amount) {
        this.userProgress.experience += amount;
        this.userProgress.totalPoints += amount;
        
        // Check for level up
        while (this.userProgress.experience >= this.userProgress.experienceToNext) {
            this.levelUp();
        }
    }

    addSkillPoints(skill, amount) {
        this.userProgress.skillPoints[skill] += amount;
    }

    levelUp() {
        this.userProgress.experience -= this.userProgress.experienceToNext;
        this.userProgress.level++;
        this.userProgress.experienceToNext = Math.floor(this.userProgress.experienceToNext * 1.2);
        
        this.showLevelUpNotification();
    }

    checkAchievements() {
        this.achievements.forEach(achievement => {
            if (!this.userProgress.achievements.includes(achievement.id) && 
                achievement.condition(this.userProgress)) {
                this.unlockAchievement(achievement);
            }
        });
    }

    unlockAchievement(achievement) {
        this.userProgress.achievements.push(achievement.id);
        this.addExperience(achievement.points);
        this.showAchievementUnlocked(achievement);
    }

    updateProgressDisplay() {
        // Update level indicator
        const levelIndicator = document.querySelector('.level-indicator');
        if (levelIndicator) {
            levelIndicator.textContent = `Lvl ${this.userProgress.level}`;
        }

        // Update experience bar
        const experienceFill = document.querySelector('.experience-fill');
        if (experienceFill) {
            const percentage = (this.userProgress.experience / this.userProgress.experienceToNext) * 100;
            experienceFill.style.width = `${percentage}%`;
        }

        // Update stats
        this.updateStatsDisplay();
        this.updateSkillsDisplay();
        this.updateAchievementsDisplay();
        this.updateDailyChallenge();
    }

    updateStatsDisplay() {
        const stats = document.querySelectorAll('.stat-number');
        if (stats.length >= 4) {
            stats[0].textContent = this.userProgress.totalPoints;
            stats[1].textContent = this.userProgress.queriesAnalyzed;
            stats[2].textContent = this.userProgress.optimizationsApplied;
            stats[3].textContent = this.userProgress.performanceTestsRun;
        }
    }

    updateSkillsDisplay() {
        const skillsGrid = document.getElementById('skills-grid');
        if (!skillsGrid) return;

        skillsGrid.innerHTML = '';
        
        Object.entries(this.skillCategories).forEach(([key, category]) => {
            const points = this.userProgress.skillPoints[key];
            const level = Math.floor(points / 20) + 1;
            const progress = (points % 20) / 20 * 100;
            
            const skillElement = document.createElement('div');
            skillElement.className = 'skill-item';
            skillElement.innerHTML = `
                <div class="skill-header">
                    <span class="skill-name">${category.name}</span>
                    <span class="skill-level">Lvl ${level}</span>
                </div>
                <div class="skill-progress">
                    <div class="skill-progress-fill" style="width: ${progress}%; background: ${category.color}"></div>
                </div>
                <small class="skill-points">${points} points</small>
            `;
            skillsGrid.appendChild(skillElement);
        });
    }

    updateAchievementsDisplay() {
        const achievementsGrid = document.getElementById('achievements-grid');
        if (!achievementsGrid) return;

        achievementsGrid.innerHTML = '';
        
        this.achievements.forEach(achievement => {
            const isUnlocked = this.userProgress.achievements.includes(achievement.id);
            const achievementElement = document.createElement('div');
            achievementElement.className = `achievement-item ${isUnlocked ? 'unlocked' : 'locked'}`;
            achievementElement.innerHTML = `
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-info">
                    <div class="achievement-title">${achievement.title}</div>
                    <div class="achievement-description">${achievement.description}</div>
                    <div class="achievement-points">+${achievement.points} XP</div>
                </div>
            `;
            achievementsGrid.appendChild(achievementElement);
        });
    }

    updateDailyChallenge() {
        const challengeCard = document.getElementById('daily-challenge');
        if (!challengeCard) return;

        const challenges = [
            { task: 'Analyze 3 Oracle queries', reward: '50 XP', progress: 0, target: 3 },
            { task: 'Run 2 performance tests', reward: '75 XP', progress: 0, target: 2 },
            { task: 'Apply 5 optimizations', reward: '100 XP', progress: 0, target: 5 },
            { task: 'Convert 2 SQL Server queries', reward: '60 XP', progress: 0, target: 2 }
        ];

        const todayChallenge = challenges[new Date().getDay() % challenges.length];
        
        challengeCard.innerHTML = `
            <div class="challenge-task">${todayChallenge.task}</div>
            <div class="challenge-progress">
                <div class="challenge-progress-bar">
                    <div class="challenge-progress-fill" style="width: ${(todayChallenge.progress / todayChallenge.target) * 100}%"></div>
                </div>
                <span class="challenge-progress-text">${todayChallenge.progress}/${todayChallenge.target}</span>
            </div>
            <div class="challenge-reward">Reward: ${todayChallenge.reward}</div>
        `;
    }

    showPointsEarned(points, message) {
        const notification = document.createElement('div');
        notification.className = 'points-notification';
        notification.innerHTML = `
            <div class="points-message">${message}</div>
            <div class="points-earned">+${points} XP</div>
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showLevelUpNotification() {
        const notification = document.createElement('div');
        notification.className = 'level-up-notification';
        notification.innerHTML = `
            <div class="level-up-icon">🎉</div>
            <div class="level-up-message">Level Up!</div>
            <div class="level-up-level">You reached Level ${this.userProgress.level}</div>
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    showAchievementUnlocked(achievement) {
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-notification-icon">${achievement.icon}</div>
            <div class="achievement-notification-content">
                <div class="achievement-notification-title">Achievement Unlocked!</div>
                <div class="achievement-notification-name">${achievement.title}</div>
                <div class="achievement-notification-points">+${achievement.points} XP</div>
            </div>
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // Static method to trigger events from other parts of the application
    static triggerEvent(eventType, details) {
        document.dispatchEvent(new CustomEvent(eventType, { detail: details }));
    }
}

// Initialize gamification system
document.addEventListener('DOMContentLoaded', function() {
    window.sqlGameification = new SQLGameification();
});

// Export for use in other modules
window.SQLGameification = SQLGameification;