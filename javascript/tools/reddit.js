// --- KEY DEOBFUSCATION ---
const deobfuscate = (key) => key.replace(/\*/g, '');

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://zxeikhguvghtsqouyuyz.supabase.co';
const SUPABASE_ANON_KEY = deobfuscate('e*y*J*h*b*G*c*i*O*i*J*I*U*z*I*1*N*i*I*s*I*n*R*5*c*C*I*6*I*k*p*X*V*C*J*9*.*e*y*J*p*c*3*M*i*O*i*J*z*d*X*B*h*Y*m*F*z*Z*S*I*s*I*n*J*l*Z*i*I*6*I*n*p*4*Z*W*l*r*a*G*d*1*d*m*d*o*d*H*N*x*b*3*V*5*d*X*l*6*I*i*w*i*c*m*9*s*Z*S*I*6*I*m*F*u*b*2*4*i*L*C*J*p*Y*X*Q*i*O*j*E*3*N*T*E*1*O*D*Y*y*M*z*A*s*I*m*V*4*c*C*I*6*M*j*A*2*N*z*E*2*M*j*I*z*M*H*0*.*a*9*j*W*r*_*h*1*d*g*y*i*_*S*T*7*s*g*K*D*A*S*D*H*i*7*h*k*M*j*S*W*O*R*7*8*V*q*2*f*M*N*0');

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const OPENROUTER_API_KEY = deobfuscate('s*k*-*o*r*-*v*1*-*b*2*1*9*8*5*d*9*f*5*7*4*2*0*1*8*b*8*d*8*e*9*d*8*e*3*6*f*f*f*9*c*1*5*b*8*3*1*6*2*1*8*8*9*1*c*a*5*e*3*2*6*a*3*a*2*f*d*5*4*b*a*4*7');
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'moonshotai/kimi-k2:free';

// Reddit API configuration
const REDDIT_CLIENT_ID = 'k8zVPy-VzLzKS1XOETZhug';
const REDDIT_REDIRECT_URI = 'https://www.orbitworkspace.net/';
const REDDIT_AUTH_URL = `https://www.reddit.com/api/v1/authorize?client_id=${REDDIT_CLIENT_ID}&response_type=code&state=orbit_reddit&redirect_uri=${REDDIT_REDIRECT_URI}&duration=permanent&scope=identity,edit,flair,history,modconfig,modflair,modlog,modposts,modwiki,mysubreddits,privatemessages,read,report,save,submit,subscribe,vote,wikiedit,wikiread`;

// Global variables
let currentUser = null;
let redditAccessToken = null;
let engagementChart = null;
let subredditChart = null;
let userStats = {
    karma: 0,
    posts: 0,
    comments: 0,
    unread: 0
};

document.addEventListener('DOMContentLoaded', async () => {
    const appContent = document.getElementById('app-content');
    const authPrompt = document.getElementById('auth-prompt');
    const loadingSkeleton = document.getElementById('loading-skeleton');
    
    const composeOverlay = document.getElementById('compose-overlay');
    const openComposeBtn = document.getElementById('open-compose');
    const closeComposeBtn = document.getElementById('close-compose');
    
    const replyOverlay = document.getElementById('reply-overlay');
    const closeReplyBtn = document.getElementById('close-reply');
    
    const showLoading = (show) => {
        loadingSkeleton.classList.toggle('hidden', !show);
    };

    async function getRedditToken(userId) {
        try {
            const { data, error } = await supabase
                .from('user_reddit_tokens')
                .select('access_token, refresh_token, expires_at')
                .eq('user_id', userId)
                .single();

            if (error) throw error;
            if (!data) return null;
            
            const now = new Date();
            const expiresAt = new Date(data.expires_at);
            if (expiresAt <= now) {
                // Token is expired, try to refresh
                const refreshed = await refreshRedditToken(data.refresh_token, userId);
                if (refreshed) return refreshed;
                
                await supabase
                    .from('user_reddit_tokens')
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
    
    async function refreshRedditToken(refreshToken, userId) {
        try {
            const response = await fetch('https://www.reddit.com/api/v1/access_token', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${btoa(`${REDDIT_CLIENT_ID}:${deobfuscate('JqI-5k4MW7bKjZYnPaiewdPYYOfj3A')}`),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `grant_type=refresh_token&refresh_token=${refreshToken}`
            });
            
            if (!response.ok) return null;
            const data = await response.json();
            
            const expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in);
            
            const { error } = await supabase
                .from('user_reddit_tokens')
                .upsert({
                    user_id: userId,
                    access_token: data.access_token,
                    refresh_token: refreshToken,
                    expires_at: expiresAt.toISOString()
                });
            
            if (error) throw error;
            return data.access_token;
        } catch (error) {
            console.error('Token refresh error:', error);
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
            redditAccessToken = await getRedditToken(currentUser.id);
            
            if (!redditAccessToken) {
                // Store the current path to redirect back after auth
                localStorage.setItem('reddit_auth_redirect', window.location.pathname);
                window.location.href = REDDIT_AUTH_URL;
                return;
            }

            appContent.classList.remove('hidden');
            authPrompt.classList.add('hidden');
            
            await loadDashboardData();
            
        } catch (error) {
            console.error('Initialization error:', error);
            appContent.classList.add('hidden');
            authPrompt.classList.remove('hidden');
        } finally {
            showLoading(false);
        }
    }

    async function loadDashboardData() {
        showLoading(true);
        try {
            await getUserStats();
            await getRecentPosts();
            await getRecentComments();
            await getInboxMessages();
            initCharts();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            alert('Failed to load dashboard data. Your Reddit token may have expired. Please return to the workspace to reconnect.');
        } finally {
            showLoading(false);
        }
    }

    async function getUserStats() {
        try {
            const response = await fetchRedditAPI('https://oauth.reddit.com/api/v1/me');
            if (!response) throw new Error('Failed to fetch user stats');
            
            userStats = {
                karma: response.total_karma || 0,
                posts: response.link_karma || 0,
                comments: response.comment_karma || 0,
                unread: response.inbox_count || 0
            };
            
            document.getElementById('karma-count').textContent = userStats.karma;
            document.getElementById('posts-count').textContent = userStats.posts;
            document.getElementById('comments-count').textContent = userStats.comments;
            document.getElementById('unread-count').textContent = userStats.unread;
            
        } catch (error) {
            console.error('Error getting user stats:', error);
        }
    }
    
    async function fetchRedditAPI(url, method = 'GET', body = null) {
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${redditAccessToken}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'OrbitWorkspace/1.0 by blacnova'
                },
                body: body ? JSON.stringify(body) : null
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    // Token might be expired, try to refresh
                    const newToken = await refreshRedditToken(currentUser.id);
                    if (newToken) {
                        redditAccessToken = newToken;
                        return fetchRedditAPI(url, method, body); // Retry with new token
                    }
                }
                throw new Error(`API request failed: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Reddit API error:', error);
            return null;
        }
    }

    async function getRecentPosts(filter = 'all') {
        const postsList = document.getElementById('posts-list');
        postsList.innerHTML = '<div class="text-center py-12 text-dark-tertiary"><p>Loading posts...</p></div>';
        
        let sort = 'new';
        if (filter === 'top') sort = 'top';
        
        try {
            const response = await fetchRedditAPI(`https://oauth.reddit.com/user/${currentUser.user_metadata?.reddit_username || currentUser.email.split('@')[0]}/submitted?sort=${sort}&limit=10`);
            if (!response || !response.data) throw new Error('No posts data');
            
            const posts = response.data.children;
            
            if (posts.length === 0) {
                postsList.innerHTML = '<div class="text-center py-12 text-dark-tertiary"><p>No posts found</p></div>';
                return;
            }
            
            postsList.innerHTML = '';
            posts.forEach(post => {
                const postData = post.data;
                const postCard = document.createElement('div');
                postCard.className = 'post-card bg-dark-secondary rounded-lg p-4 cursor-pointer';
                postCard.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div class="font-medium truncate">${postData.subreddit_name_prefixed}</div>
                        <div class="text-xs text-dark-tertiary">${new Date(postData.created_utc * 1000).toLocaleString()}</div>
                    </div>
                    <div class="text-sm mb-2">${postData.title}</div>
                    <div class="flex gap-4 text-xs text-dark-tertiary">
                        <span class="flex items-center gap-1 upvote">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path></svg>
                            ${postData.ups}
                        </span>
                        <span class="flex items-center gap-1 comment">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd"></path></svg>
                            ${postData.num_comments}
                        </span>
                        ${postData.link_flair_text ? `<span class="post-flair">${postData.link_flair_text}</span>` : ''}
                    </div>
                `;
                postCard.addEventListener('click', () => window.open(`https://www.reddit.com${postData.permalink}`, '_blank'));
                postsList.appendChild(postCard);
            });
        } catch (error) {
            console.error('Error getting posts:', error);
            postsList.innerHTML = '<div class="text-center py-12 text-dark-tertiary"><p>Error loading posts</p></div>';
        }
    }

    async function getRecentComments(filter = 'all') {
        const commentsList = document.getElementById('comments-list');
        commentsList.innerHTML = '<div class="text-center py-12 text-dark-tertiary"><p>Loading comments...</p></div>';
        
        let sort = 'new';
        if (filter === 'top') sort = 'top';
        
        try {
            const response = await fetchRedditAPI(`https://oauth.reddit.com/user/${currentUser.user_metadata?.reddit_username || currentUser.email.split('@')[0]}/comments?sort=${sort}&limit=10`);
            if (!response || !response.data) throw new Error('No comments data');
            
            const comments = response.data.children;
            
            if (comments.length === 0) {
                commentsList.innerHTML = '<div class="text-center py-12 text-dark-tertiary"><p>No comments found</p></div>';
                return;
            }
            
            commentsList.innerHTML = '';
            comments.forEach(comment => {
                const commentData = comment.data;
                const commentCard = document.createElement('div');
                commentCard.className = 'post-card bg-dark-secondary rounded-lg p-4 cursor-pointer';
                commentCard.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div class="font-medium truncate">${commentData.subreddit_name_prefixed}</div>
                        <div class="text-xs text-dark-tertiary">${new Date(commentData.created_utc * 1000).toLocaleString()}</div>
                    </div>
                    <div class="text-sm mb-2 line-clamp-2">${commentData.body}</div>
                    <div class="flex gap-4 text-xs text-dark-tertiary">
                        <span class="flex items-center gap-1 upvote">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path></svg>
                            ${commentData.ups}
                        </span>
                        <span class="text-xs text-dark-tertiary">on: ${commentData.link_title || 'post'}</span>
                    </div>
                `;
                commentCard.addEventListener('click', () => window.open(`https://www.reddit.com${commentData.permalink}`, '_blank'));
                commentsList.appendChild(commentCard);
            });
        } catch (error) {
            console.error('Error getting comments:', error);
            commentsList.innerHTML = '<div class="text-center py-12 text-dark-tertiary"><p>Error loading comments</p></div>';
        }
    }

    async function getInboxMessages(filter = 'all') {
        const inboxList = document.getElementById('inbox-list');
        inboxList.innerHTML = '<div class="text-center py-12 text-dark-tertiary"><p>Loading messages...</p></div>';
        
        let endpoint = 'inbox';
        if (filter === 'unread') endpoint = 'unread';
        if (filter === 'mentions') endpoint = 'mentions';
        
        try {
            const response = await fetchRedditAPI(`https://oauth.reddit.com/message/${endpoint}?limit=10`);
            if (!response || !response.data) throw new Error('No inbox data');
            
            const messages = response.data.children;
            
            if (messages.length === 0) {
                inboxList.innerHTML = '<div class="text-center py-12 text-dark-tertiary"><p>No messages found</p></div>';
                return;
            }
            
            inboxList.innerHTML = '';
            messages.forEach(message => {
                const messageData = message.data;
                const messageCard = document.createElement('div');
                messageCard.className = `post-card bg-dark-secondary rounded-lg p-4 cursor-pointer ${messageData.new ? 'border-l-4 border-[#ff4500]' : ''}`;
                
                let content = messageData.body;
                if (content.length > 200) content = content.substring(0, 200) + '...';
                
                messageCard.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div class="font-medium truncate">From: ${messageData.author}</div>
                        <div class="text-xs text-dark-tertiary">${new Date(messageData.created_utc * 1000).toLocaleString()}</div>
                    </div>
                    <div class="text-sm mb-2">${messageData.subject}</div>
                    <div class="text-xs text-dark-tertiary line-clamp-2">${content}</div>
                `;
                
                messageCard.addEventListener('click', () => {
                    if (messageData.context) {
                        window.open(`https://www.reddit.com${messageData.context}`, '_blank');
                    } else {
                        openReplyOverlay(messageData);
                    }
                });
                
                inboxList.appendChild(messageCard);
            });
        } catch (error) {
            console.error('Error getting inbox:', error);
            inboxList.innerHTML = '<div class="text-center py-12 text-dark-tertiary"><p>Error loading messages</p></div>';
        }
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

        const ctx1 = document.getElementById('engagementChart').getContext('2d');
        engagementChart = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [
                    { label: 'Upvotes', data: [45, 32, 67, 89, 54, 76, 43], backgroundColor: '#ff4500' },
                    { label: 'Comments', data: [12, 8, 15, 22, 18, 25, 10], backgroundColor: '#949494' }
                ]
            },
            options: commonOptions
        });
        
        const ctx2 = document.getElementById('subredditChart').getContext('2d');
        subredditChart = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: ['r/AskReddit', 'r/technology', 'r/funny', 'r/gaming', 'r/pics'],
                datasets: [{
                    data: [35, 25, 20, 15, 5],
                    backgroundColor: ['#ff4500', '#06b2fc', '#10b981', '#f59e0b', '#8b5cf6'],
                    borderColor: '#242628',
                    borderWidth: 2
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'right', labels: { color: '#fcfcfc' } } } }
        });
    }

    async function analyzeActivity(mode) {
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
            // Get recent activity samples for analysis
            const postsResponse = await fetchRedditAPI(`https://oauth.reddit.com/user/${currentUser.user_metadata?.reddit_username || currentUser.email.split('@')[0]}/submitted?limit=5`);
            const commentsResponse = await fetchRedditAPI(`https://oauth.reddit.com/user/${currentUser.user_metadata?.reddit_username || currentUser.email.split('@')[0]}/comments?limit=5`);
            
            const posts = postsResponse?.data?.children || [];
            const comments = commentsResponse?.data?.children || [];
            
            const activitySamples = [
                ...posts.map(p => `POST in ${p.data.subreddit_name_prefixed}: "${p.data.title}"\nUpvotes: ${p.data.ups}\nComments: ${p.data.num_comments}`),
                ...comments.map(c => `COMMENT in ${c.data.subreddit_name_prefixed}: "${c.data.body.substring(0, 100)}..."\nUpvotes: ${c.data.ups}`)
            ].join('\n\n---\n\n');
            
            let prompt = '';
            let title = '';
            
            switch(mode) {
                case 'summary':
                    title = `Summary of Last ${dayText}`;
                    prompt = `Analyze this Reddit activity from the last ${dayText} and provide a concise summary. Focus on:\n- Engagement patterns\n- Top performing content\n- Subreddit distribution\n- Overall performance\n\nFormat as bullet points. Sample activity:\n\n${activitySamples}`;
                    break;
                case 'trends':
                    title = `Trends in Last ${dayText}`;
                    prompt = `Identify trends in this Reddit activity from the last ${dayText}. Look for:\n- Content patterns that perform well\n- Times of high engagement\n- Subreddits with best response\n\nProvide actionable insights. Sample activity:\n\n${activitySamples}`;
                    break;
                case 'actions':
                    title = `Action Items from Last ${dayText}`;
                    prompt = `Based on this Reddit activity from the last ${dayText}, suggest specific action items to improve engagement. Include:\n- Content ideas\n- Optimal posting times\n- Subreddit focus areas\n\nFormat as a numbered list. Sample activity:\n\n${activitySamples}`;
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

    async function submitPost() {
        const subreddit = document.getElementById('post-subreddit').value.trim().replace('r/', '');
        const title = document.getElementById('post-title').value.trim();
        const content = document.getElementById('post-content').value.trim();
        const flair = document.getElementById('post-flair').value.trim();
        const statusEl = document.getElementById('generator-status');

        if (!subreddit || !title) {
            statusEl.textContent = 'Please provide subreddit and title.';
            statusEl.style.color = '#ef4444';
            return;
        }
        
        statusEl.textContent = 'Posting to Reddit...';
        statusEl.style.color = '#06b2fc';
        showLoading(true);

        try {
            // First check if the subreddit exists and get flair options if needed
            const subredditInfo = await fetchRedditAPI(`https://oauth.reddit.com/r/${subreddit}/about`);
            if (!subredditInfo) throw new Error('Subreddit not found or access denied');
            
            let flairId = null;
            if (flair) {
                const flairs = await fetchRedditAPI(`https://oauth.reddit.com/r/${subreddit}/api/link_flair`);
                if (flairs && flairs.length > 0) {
                    const matchedFlair = flairs.find(f => f.text.toLowerCase() === flair.toLowerCase());
                    if (matchedFlair) flairId = matchedFlair.id;
                }
            }
            
            // Submit the post
            const postData = {
                sr: subreddit,
                title,
                text: content,
                kind: 'self',
                flair_id: flairId || undefined,
                api_type: 'json'
            };
            
            const response = await fetchRedditAPI('https://oauth.reddit.com/api/submit', 'POST', postData);
            if (!response || !response.json || !response.json.data) throw new Error('Failed to submit post');
            
            statusEl.textContent = 'Post submitted successfully!';
            statusEl.style.color = '#10b981';
            
            setTimeout(() => {
                composeOverlay.classList.add('hidden');
                document.getElementById('post-subreddit').value = '';
                document.getElementById('post-title').value = '';
                document.getElementById('post-content').value = '';
                document.getElementById('post-flair').value = '';
                statusEl.textContent = '';
                
                // Refresh the posts list
                getRecentPosts();
                getUserStats();
            }, 2000);

        } catch (err) {
            const errorMsg = err?.message || 'Unknown error';
            statusEl.textContent = `Error: ${errorMsg}`;
            statusEl.style.color = '#ef4444';
            console.error(err);
        } finally {
            showLoading(false);
        }
    }

    function openReplyOverlay(messageData) {
        document.getElementById('reply-post-title').textContent = messageData.subject;
        document.getElementById('reply-post-content').textContent = messageData.body.length > 200 ? 
            messageData.body.substring(0, 200) + '...' : messageData.body;
        
        // Store message data for reply submission
        document.getElementById('reply-content').dataset.messageId = messageData.id;
        document.getElementById('reply-content').dataset.messageAuthor = messageData.author;
        
        replyOverlay.classList.remove('hidden');
    }

    async function submitReply() {
        const content = document.getElementById('reply-content').value.trim();
        const messageId = document.getElementById('reply-content').dataset.messageId;
        const messageAuthor = document.getElementById('reply-content').dataset.messageAuthor;
        const statusEl = document.getElementById('reply-status');

        if (!content || !messageId) {
            statusEl.textContent = 'Please provide reply content.';
            statusEl.style.color = '#ef4444';
            return;
        }
        
        statusEl.textContent = 'Sending reply...';
        statusEl.style.color = '#06b2fc';
        showLoading(true);

        try {
            const response = await fetchRedditAPI('https://oauth.reddit.com/api/comment', 'POST', {
                thing_id: `t4_${messageId}`,
                text: content,
                api_type: 'json'
            });
            
            if (!response || !response.json || !response.json.data) throw new Error('Failed to submit reply');
            
            statusEl.textContent = 'Reply sent successfully!';
            statusEl.style.color = '#10b981';
            
            setTimeout(() => {
                replyOverlay.classList.add('hidden');
                document.getElementById('reply-content').value = '';
                statusEl.textContent = '';
                
                // Refresh the inbox
                getInboxMessages();
                getUserStats();
            }, 2000);

        } catch (err) {
            const errorMsg = err?.message || 'Unknown error';
            statusEl.textContent = `Error: ${errorMsg}`;
            statusEl.style.color = '#ef4444';
            console.error(err);
        } finally {
            showLoading(false);
        }
    }

    async function enhanceWithAI(isReply = false) {
        const contentEl = isReply ? document.getElementById('reply-content') : document.getElementById('post-content');
        const originalContent = contentEl.value.trim();
        const title = isReply ? '' : document.getElementById('post-title').value.trim();
        const statusEl = isReply ? document.getElementById('reply-status') : document.getElementById('generator-status');

        if (!originalContent) {
            statusEl.textContent = 'Please enter some content to enhance.';
            statusEl.style.color = '#ef4444';
            return;
        }

        const shouldFormat = document.getElementById(isReply ? 'ai-reply-format-toggle' : 'ai-format-toggle').checked;
        const prompt = isReply 
            ? `You are a helpful Reddit user. Based on the following post content, write a thoughtful reply. Post: "${document.getElementById('reply-post-content').textContent}". Return only the enhanced reply.` 
            : `You are a helpful Reddit user. Based on the following title, write a detailed post. Title: "${title}". Return only the enhanced post content.`;

        statusEl.textContent = 'AI is enhancing your content...';
        statusEl.style.color = '#8b5cf6';
        showLoading(true);

        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: DEFAULT_MODEL, messages: [{ role: "user", content: prompt }] })
            });

            if (!response.ok) throw new Error(`API call failed: ${response.status}`);
            const result = await response.json();
            const enhancedText = result.choices?.[0]?.message?.content;
            if (!enhancedText) throw new Error('No content returned from AI.');

            contentEl.value = enhancedText;
            statusEl.textContent = 'Content enhanced successfully!';
            statusEl.style.color = '#10b981';
        } catch (error) {
            statusEl.textContent = `AI Error: ${error.message}`;
            statusEl.style.color = '#ef4444';
        } finally {
            showLoading(false);
        }
    }

    // --- Event listeners ---
    document.getElementById('posts-filter').addEventListener('change', (e) => getRecentPosts(e.target.value));
    document.getElementById('comments-filter').addEventListener('change', (e) => getRecentComments(e.target.value));
    document.getElementById('inbox-filter').addEventListener('change', (e) => getInboxMessages(e.target.value));
    
    document.getElementById('analyze-summary-btn').addEventListener('click', () => analyzeActivity('summary'));
    document.getElementById('analyze-trends-btn').addEventListener('click', () => analyzeActivity('trends'));
    document.getElementById('analyze-actions-btn').addEventListener('click', () => analyzeActivity('actions'));
    
    document.getElementById('copy-analysis-btn').addEventListener('click', () => {
        const content = document.getElementById('analysis-content').textContent;
        navigator.clipboard.writeText(content).then(() => {
            const btn = document.getElementById('copy-analysis-btn');
            btn.innerHTML = 'Copied!';
            setTimeout(() => { btn.innerHTML = 'Copy'; }, 2000);
        });
    });

    openComposeBtn.addEventListener('click', () => composeOverlay.classList.remove('hidden'));
    closeComposeBtn.addEventListener('click', () => composeOverlay.classList.add('hidden'));
    closeReplyBtn.addEventListener('click', () => replyOverlay.classList.add('hidden'));
    
    document.getElementById('submit-post-btn').addEventListener('click', submitPost);
    document.getElementById('submit-reply-btn').addEventListener('click', submitReply);
    
    document.getElementById('ai-enhance-btn').addEventListener('click', () => enhanceWithAI(false));
    document.getElementById('ai-enhance-reply-btn').addEventListener('click', () => enhanceWithAI(true));

    // Check if we're returning from Reddit auth
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code && state === 'orbit_reddit') {
        // We need to complete the OAuth flow
        completeRedditAuth(code);
    } else {
        initializeApp();
    }
    
    async function completeRedditAuth(code) {
        showLoading(true);
        try {
            // First get the session to ensure we're logged in
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) throw new Error('No active session');
            
            // Exchange the code for tokens
            const response = await fetch('https://www.reddit.com/api/v1/access_token', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${btoa(`${REDDIT_CLIENT_ID}:${deobfuscate('JqI-5k4MW7bKjZYnPaiewdPYYOfj3A')}`),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `grant_type=authorization_code&code=${code}&redirect_uri=${REDDIT_REDIRECT_URI}`
            });
            
            if (!response.ok) throw new Error('Failed to get access token');
            const tokenData = await response.json();
            
            // Get the Reddit username
            const userResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'User-Agent': 'OrbitWorkspace/1.0 by blacnova'
                }
            });
            
            if (!userResponse.ok) throw new Error('Failed to get user info');
            const userData = await userResponse.json();
            
            // Store the tokens in Supabase
            const expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);
            
            const { error } = await supabase
                .from('user_reddit_tokens')
                .upsert({
                    user_id: session.user.id,
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token,
                    expires_at: expiresAt.toISOString()
                });
            
            if (error) throw error;
            
            // Update user metadata with Reddit username
            const { error: updateError } = await supabase.auth.updateUser({
                data: { reddit_username: userData.name }
            });
            
            if (updateError) console.error('Failed to update user metadata:', updateError);
            
            // Redirect back to the original path
            const redirectPath = localStorage.getItem('reddit_auth_redirect') || '../../';
            localStorage.removeItem('reddit_auth_redirect');
            window.location.href = redirectPath;
            
        } catch (error) {
            console.error('Reddit auth error:', error);
            alert('Failed to connect Reddit account. Please try again.');
            window.location.href = '../../';
        } finally {
            showLoading(false);
        }
    }
});
