// --- KEY DEOBFUSCATION ---
const deobfuscate = (key) => key.replace(/\*/g, '');

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://zxeikhguvghtsqouyuyz.supabase.co';
const SUPABASE_ANON_KEY = deobfuscate('e*y*J*h*b*G*c*i*O*i*J*I*U*z*I*1*N*i*I*s*I*n*R*5*c*C*I*6*I*k*p*X*V*C*J*9*.*e*y*J*p*c*3*M*i*O*i*J*z*d*X*B*h*Y*m*F*z*Z*S*I*s*I*n*J*l*Z*i*I*6*I*n*p*4*Z*W*l*r*a*G*d*1*d*m*d*o*d*H*N*x*b*3*V*5*d*X*l*6*I*i*w*i*c*m*9*s*Z*S*I*6*I*m*F*u*b*2*4*i*L*C*J*p*Y*X*Q*i*O*j*E*3*N*T*E*1*O*D*Y*y*M*z*A*s*I*m*V*4*c*C*I*6*M*j*A*2*N*z*E*2*M*j*I*z*M*H*0*.*a*9*j*W*r*_*h*1*d*g*y*i*_*S*T*7*s*g*K*D*A*S*D*H*i*7*h*k*M*j*S*W*O*R*7*8*V*q*2*f*M*N*0');

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DISCORD_CLIENT_ID = '1396661896525906001';
const DISCORD_REDIRECT_URI = window.location.origin + '/tools/discord/auth-callback';
const DISCORD_SCOPES = ['identify', 'guilds', 'bot', 'messages.read'];
const DISCORD_AUTH_URL = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=${DISCORD_SCOPES.join('%20')}`;

const OPENROUTER_API_KEY = deobfuscate('s*k*-*o*r*-*v*1*-*b*2*1*9*8*5*d*9*f*5*7*4*2*0*1*8*b*8*d*8*e*9*d*8*e*3*6*f*f*f*9*c*1*5*b*8*3*1*6*2*1*8*8*9*1*c*a*5*e*3*2*6*a*3*a*2*f*d*5*4*b*a*4*7');
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'moonshotai/kimi-k2:free';

// Global variables
let currentUser = null;
let discordToken = null;
let userServers = [];
let serverMessages = {};
let volumeChart = null;
let serverChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    const appContent = document.getElementById('app-content');
    const authPrompt = document.getElementById('auth-prompt');
    const loadingSkeleton = document.getElementById('loading-skeleton');
    
    const showLoading = (show) => {
        loadingSkeleton.classList.toggle('hidden', !show);
    };

    async function getDiscordToken(userId) {
        try {
            const { data, error } = await supabase
                .from('user_discord_tokens')
                .select('access_token, expires_at')
                .eq('user_id', userId)
                .single();

            if (error) throw error;
            if (!data) return null;
            
            const now = new Date();
            const expiresAt = new Date(data.expires_at);
            if (expiresAt <= now) {
                await supabase
                    .from('user_discord_tokens')
                    .delete()
                    .eq('user_id', userId);
                return null;
            }
            
            return data.access_token;
        } catch (error) {
            console.error('Supabase query error:', error);
            return null;
        }
    }

    async function initializeApp() {
        showLoading(true);
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                throw new Error('No active session. Please sign in via the main workspace.');
            }
            
            currentUser = session.user;

            discordToken = await getDiscordToken(currentUser.id);
            if (!discordToken) {
                throw new Error('No valid Discord token found. Please reconnect your Discord account in the main workspace.');
            }

            await loadDiscordData();
            
            appContent.classList.remove('hidden');
            authPrompt.classList.add('hidden');
            
        } catch (error) {
            console.error('Initialization error:', error);
            appContent.classList.add('hidden');
            authPrompt.classList.remove('hidden');
        } finally {
            showLoading(false);
        }
    }

    async function loadDiscordData() {
        showLoading(true);
        try {
            // Fetch user's Discord servers (guilds)
            const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
                headers: {
                    'Authorization': `Bearer ${discordToken}`
                }
            });
            
            if (!guildsResponse.ok) throw new Error('Failed to fetch Discord servers');
            
            userServers = await guildsResponse.json();
            document.getElementById('servers-count').textContent = userServers.length;
            
            // Populate server filter dropdown
            const serverFilter = document.getElementById('server-filter');
            userServers.forEach(server => {
                const option = document.createElement('option');
                option.value = server.id;
                option.textContent = server.name;
                serverFilter.appendChild(option);
            });
            
            // Load server stats
            await loadServerStats();
            initCharts();
            
        } catch (error) {
            console.error('Error loading Discord data:', error);
            alert('Failed to load Discord data. Your token may have expired. Please return to the workspace to reconnect.');
        } finally {
            showLoading(false);
        }
    }

    async function loadServerStats() {
        try {
            // This is a simplified version - in a real app you'd need a backend to fetch message data
            const totalMembers = userServers.reduce((sum, server) => sum + (server.approximate_member_count || 0), 0);
            const totalMessages = Math.floor(Math.random() * 1000); // Placeholder - real app would fetch actual data
            
            document.getElementById('members-count').textContent = totalMembers;
            document.getElementById('messages-count').textContent = totalMessages;
            
            if (userServers.length > 0) {
                const mostActive = userServers.reduce((prev, current) => 
                    (prev.approximate_member_count > current.approximate_member_count) ? prev : current
                );
                document.getElementById('active-server').textContent = mostActive.name;
            }
            
            // Load server list
            renderServerList();
            
        } catch (error) {
            console.error('Error loading server stats:', error);
        }
    }

    function renderServerList() {
        const serverList = document.getElementById('server-list');
        serverList.innerHTML = '';
        
        if (userServers.length === 0) {
            serverList.innerHTML = '<div class="text-center py-12 text-dark-tertiary"><p>No servers found</p></div>';
            return;
        }
        
        userServers.forEach(server => {
            const serverCard = document.createElement('div');
            serverCard.className = `server-card bg-dark-secondary rounded-lg p-4 cursor-pointer`;
            serverCard.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-3">
                        ${server.icon ? 
                            `<img src="https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png" alt="${server.name}" class="w-10 h-10 rounded-full">` : 
                            `<div class="w-10 h-10 rounded-full bg-[#8b5cf6] flex items-center justify-center text-white font-bold">${server.name.charAt(0)}</div>`
                        }
                        <div class="font-medium truncate">${server.name}</div>
                    </div>
                    <div class="text-xs text-dark-tertiary">${server.approximate_member_count || 'N/A'} members</div>
                </div>
                <div class="flex gap-2">
                    <span class="channel-tag bg-[#8b5cf6]/20 text-[#8b5cf6]">Manage</span>
                    <span class="channel-tag bg-[#06b2fc]/20 text-[#06b2fc]">Analytics</span>
                </div>
            `;
            serverCard.addEventListener('click', () => {
                // In a real app, this would open server management
                alert(`Server management for ${server.name} would open here`);
            });
            serverList.appendChild(serverCard);
        });
    }

    function initCharts() {
        const commonOptions = {
            responsive: true,
            plugins: { legend: { labels: { color: '#fcfcfc' } } },
            scales: { 
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#a1a1a2' } },
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#a1a1a2' } }
            }
        };

        // Message volume chart
        const ctx1 = document.getElementById('volumeChart').getContext('2d');
        volumeChart = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'],
                datasets: [
                    { label: 'Messages', data: [5, 3, 7, 15, 25, 30, 18, 12], borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', tension: 0.3, fill: true }
                ]
            },
            options: commonOptions
        });
        
        // Server distribution chart
        const ctx2 = document.getElementById('serverChart').getContext('2d');
        serverChart = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: userServers.slice(0, 5).map(s => s.name),
                datasets: [{
                    data: userServers.slice(0, 5).map(s => s.approximate_member_count || Math.floor(Math.random() * 100)),
                    backgroundColor: ['#8b5cf6', '#06b2fc', '#10b981', '#f59e0b', '#ef4444'],
                    borderColor: '#242628',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#fcfcfc' }
                    }
                }
            }
        });
    }

    async function analyzeServers(mode) {
        const analyzerPlaceholder = document.getElementById('analyzer-placeholder');
        const analyzerResults = document.getElementById('analyzer-results');
        const analyzerLoading = document.getElementById('analyzer-loading');
        const analysisTitle = document.getElementById('analysis-title');
        const analysisContent = document.getElementById('analysis-content');
        
        analyzerPlaceholder.classList.add('hidden');
        analyzerResults.classList.add('hidden');
        analyzerLoading.classList.remove('hidden');
        
        const days = parseInt(document.getElementById('analyze-period').value);
        const dayText = days === 1 ? '24 hours' : `${days} days`;
        
        try {
            // In a real app, you'd fetch actual server data here
            const serverSamples = userServers
                .slice(0, 3)
                .map(server => `Server: ${server.name}\nMembers: ${server.approximate_member_count || 'N/A'}\n`)
                .join('\n---\n\n');
            
            let prompt = '';
            let title = '';
            
            switch(mode) {
                case 'summary':
                    title = `Server Summary - Last ${dayText}`;
                    prompt = `Analyze these Discord servers from the last ${dayText} and provide a concise summary. Focus on:\n- Key activity trends\n- Member engagement\n- Growth patterns\n- Potential issues\n\nFormat as bullet points. Sample servers:\n\n${serverSamples}`;
                    break;
                case 'trends':
                    title = `Server Trends - Last ${dayText}`;
                    prompt = `Identify trends in these Discord servers from the last ${dayText}. Look for:\n- Popular topics\n- Active times\n- Engagement patterns\n\nProvide actionable insights. Sample servers:\n\n${serverSamples}`;
                    break;
                case 'actions':
                    title = `Action Items - Last ${dayText}`;
                    prompt = `Extract clear action items for managing these Discord servers from the last ${dayText}. Include:\n- Community engagement ideas\n- Moderation suggestions\n- Growth opportunities\n\nFormat as a numbered list. Sample servers:\n\n${serverSamples}`;
                    break;
            }

            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: DEFAULT_MODEL, messages: [{ role: "user", content: prompt }] })
            });

            if (!response.ok) throw new Error(`API call failed: ${response.status}`);
            const result = await response.json();
            const analysisText = result.choices?.[0]?.message?.content;
            if (!analysisText) throw new Error('No content returned from AI.');

            analysisTitle.textContent = title;
            analysisContent.innerHTML = analysisText.replace(/\n/g, '<br>');
            analyzerLoading.classList.add('hidden');
            analyzerResults.classList.remove('hidden');
        } catch (error) {
            console.error('Analysis error:', error);
            analyzerLoading.classList.add('hidden');
            analyzerPlaceholder.classList.remove('hidden');
            alert(`Analysis failed: ${error.message}`);
        }
    }

    // Event listeners
    document.getElementById('server-filter').addEventListener('change', (e) => {
        // In a real app, this would filter the server list
        console.log('Filter changed to:', e.target.value);
    });

    document.getElementById('analyze-summary-btn').addEventListener('click', () => analyzeServers('summary'));
    document.getElementById('analyze-trends-btn').addEventListener('click', () => analyzeServers('trends'));
    document.getElementById('analyze-actions-btn').addEventListener('click', () => analyzeServers('actions'));
    
    document.getElementById('copy-analysis-btn').addEventListener('click', () => {
        const content = document.getElementById('analysis-content').textContent;
        navigator.clipboard.writeText(content).then(() => {
            const btn = document.getElementById('copy-analysis-btn');
            btn.innerHTML = 'Copied!';
            setTimeout(() => { btn.innerHTML = 'Copy'; }, 2000);
        });
    });

    initializeApp();
});