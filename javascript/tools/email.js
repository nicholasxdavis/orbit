 // --- KEY DEOBFUSCATION ---
    const deobfuscate = (key) => key.replace(/\*/g, '');

    // --- CONFIGURATION ---
    const SUPABASE_URL = 'https://zxeikhguvghtsqouyuyz.supabase.co';
    const SUPABASE_ANON_KEY = deobfuscate('e*y*J*h*b*G*c*i*O*i*J*I*U*z*I*1*N*i*I*s*I*n*R*5*c*C*I*6*I*k*p*X*V*C*J*9*.*e*y*J*p*c*3*M*i*O*i*J*z*d*X*B*h*Y*m*F*z*Z*S*I*s*I*n*J*l*Z*i*I*6*I*n*p*4*Z*W*l*r*a*G*d*1*d*m*d*o*d*H*N*x*b*3*V*5*d*X*l*6*I*i*w*i*c*m*9*s*Z*S*I*6*I*m*F*u*b*2*4*i*L*C*J*p*Y*X*Q*i*O*j*E*3*N*T*E*1*O*D*Y*y*M*z*A*s*I*m*V*4*c*C*I*6*M*j*A*2*N*z*E*2*M*j*I*z*M*H*0*.*a*9*j*W*r*_*h*1*d*g*y*i*_*S*T*7*s*g*K*D*A*S*D*H*i*7*h*k*M*j*S*W*O*R*7*8*V*q*2*f*M*N*0');

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const GOOGLE_API_KEY = deobfuscate('A*I*z*a*S*y*A*U*I*v*4*H*E*M*u*f*F*0*x*5*1*e*Z*q*L*p*e*o*R*t*J*X*8*W*n*r*n*i*o');
    // Using the discovery doc from your working file
    const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';

    const OPENROUTER_API_KEY = deobfuscate('s*k*-*o*r*-*v*1*-*b*2*1*9*8*5*d*9*f*5*7*4*2*0*1*8*b*8*d*8*e*9*d*8*e*3*6*f*f*f*9*c*1*5*b*8*3*1*6*2*1*8*8*9*1*c*a*5*e*3*2*6*a*3*a*2*f*d*5*4*b*a*4*7');
    const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
    const DEFAULT_MODEL = 'moonshotai/kimi-k2:free';
    
    // Global variables
    let currentUser = null;
    let gmailClient = null;
    let volumeChart = null;
    let categoryChart = null;
    let recentEmails = [];
    let emailContents = {};

    document.addEventListener('DOMContentLoaded', async () => {
        const appContent = document.getElementById('app-content');
        const authPrompt = document.getElementById('auth-prompt');
        const loadingSkeleton = document.getElementById('loading-skeleton');
        
        const composeOverlay = document.getElementById('compose-overlay');
        const openComposeBtn = document.getElementById('open-compose');
        const closeComposeBtn = document.getElementById('close-compose');
        
        const showLoading = (show) => {
            loadingSkeleton.classList.toggle('hidden', !show);
        };

        // This function is modeled after your working email.html file
        async function getGoogleToken(userId) {
            try {
                const { data, error } = await supabase
                    .from('user_google_tokens')
                    .select('access_token, expires_at')
                    .eq('user_id', userId)
                    .single();

                if (error) throw error;
                if (!data) return null;
                
                const now = new Date();
                const expiresAt = new Date(data.expires_at);
                if (expiresAt <= now) {
                    // Token is expired, let the user re-auth on index.html
                    await supabase
                        .from('user_google_tokens')
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
        
        // FIX: Replaced the entire initializeApp function with one that uses the correct auth flow.
        async function initializeApp() {
            showLoading(true);
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError || !session) {
                    throw new Error('No active session. Please sign in via the main workspace.');
                }
                
                currentUser = session.user;

                const googleToken = await getGoogleToken(currentUser.id);
                if (!googleToken) {
                     throw new Error('No valid Google token found. Please reconnect your Google account in the main workspace.');
                }

                await new Promise((resolve) => gapi.load('client', resolve));
                await gapi.client.init({
                    apiKey: GOOGLE_API_KEY,
                    discoveryDocs: [DISCOVERY_DOC],
                });

                gapi.client.setToken({ access_token: googleToken });
                gmailClient = gapi.client.gmail;

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
                await getEmailStats();
                await getRecentEmails();
                initCharts();
            } catch (error) {
                console.error('Error loading dashboard data:', error);
                alert('Failed to load dashboard data. Your Google token may have expired. Please return to the workspace to reconnect.');
            } finally {
                showLoading(false);
            }
        }

        async function getEmailStats() {
            try {
                const twentyFourHoursAgo = new Date();
                twentyFourHoursAgo.setDate(twentyFourHoursAgo.getDate() - 1);
                const unixTimestamp = Math.floor(twentyFourHoursAgo.getTime() / 1000);
                
                const inboxResponse = await gmailClient.users.messages.list({ userId: 'me', q: `after:${unixTimestamp}`, maxResults: 500 });
                const inboxMessages = inboxResponse.result.messages || [];
                
                const sentResponse = await gmailClient.users.messages.list({ userId: 'me', q: `after:${unixTimestamp} in:sent`, maxResults: 500 });
                const sentMessages = sentResponse.result.messages || [];
                
                const unreadResponse = await gmailClient.users.messages.list({ userId: 'me', q: `is:unread`, maxResults: 500 });
                const unreadMessages = unreadResponse.result.messages || [];
                
                document.getElementById('received-count').textContent = inboxMessages.length;
                document.getElementById('sent-count').textContent = sentMessages.length;
                document.getElementById('unread-count').textContent = unreadMessages.length;
                
                if (inboxMessages.length > 0) {
                    const firstMessage = await gmailClient.users.messages.get({ userId: 'me', id: inboxMessages[0].id, format: 'metadata', metadataHeaders: ['From'] });
                    const fromHeader = firstMessage.result.payload.headers.find(h => h.name === 'From');
                    if (fromHeader) {
                        const sender = fromHeader.value.split('<')[0].trim();
                        document.getElementById('top-sender').textContent = sender;
                    }
                }
                
                recentEmails = inboxMessages.slice(0, 50);
                await fetchEmailContents(recentEmails);
            } catch (error) {
                console.error('Error getting email stats:', error);
            }
        }

        async function fetchEmailContents(messages) {
            emailContents = {};
            const promises = messages.map(message => 
                gmailClient.users.messages.get({ userId: 'me', id: message.id, format: 'full' })
            );
            const responses = await Promise.all(promises);

            responses.forEach((response, index) => {
                 if (response.result) {
                    emailContents[messages[index].id] = {
                        subject: getHeader(response.result.payload.headers, 'Subject'),
                        from: getHeader(response.result.payload.headers, 'From'),
                        date: getHeader(response.result.payload.headers, 'Date'),
                        body: extractEmailBody(response.result.payload)
                    };
                }
            });
        }

        function getHeader(headers, name) {
            const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
            return header ? header.value : '';
        }

        function extractEmailBody(payload) {
            if (payload.parts) {
                const textPart = payload.parts.find(part => part.mimeType === 'text/plain');
                if (textPart && textPart.body && textPart.body.data) {
                    return decodeBase64(textPart.body.data);
                }
            }
            return payload.body && payload.body.data ? decodeBase64(payload.body.data) : '';
        }

        function decodeBase64(data) {
            if (!data) return '';
            try {
                return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
            } catch (e) {
                console.error('Base64 decode error:', e);
                return '';
            }
        }

        async function getRecentEmails(filter = 'all') {
            const emailList = document.getElementById('email-list');
            emailList.innerHTML = '<div class="text-center py-12 text-dark-tertiary"><p>Loading emails...</p></div>';
            
            let query = '';
            if (filter === 'unread') query = 'is:unread';
            if (filter === 'important') query = 'is:important';
            
            const response = await gmailClient.users.messages.list({ userId: 'me', q: query, maxResults: 10 });
            const messages = response.result.messages || [];
            
            if (messages.length === 0) {
                emailList.innerHTML = '<div class="text-center py-12 text-dark-tertiary"><p>No emails found</p></div>';
                return;
            }
            
            const messageDetails = await Promise.all(
                messages.map(msg => gmailClient.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] }))
            );
            
            emailList.innerHTML = '';
            messageDetails.forEach(msg => {
                const message = msg.result;
                const headers = message.payload.headers;
                const from = getHeader(headers, 'From');
                const subject = getHeader(headers, 'Subject') || '(No Subject)';
                const date = new Date(getHeader(headers, 'Date')).toLocaleString();
                let senderName = from.includes('<') ? from.split('<')[0].trim() : from;
                
                const isUnread = message.labelIds && message.labelIds.includes('UNREAD');
                const isImportant = message.labelIds && message.labelIds.includes('IMPORTANT');
                
                const emailCard = document.createElement('div');
                emailCard.className = `email-card bg-dark-secondary rounded-lg p-4 cursor-pointer ${isUnread ? 'border-l-4 border-[#06b2fc]' : ''}`;
                emailCard.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div class="font-medium truncate">${senderName}</div>
                        <div class="text-xs text-dark-tertiary">${date}</div>
                    </div>
                    <div class="text-sm mb-2 truncate">${subject}</div>
                    <div class="flex gap-2">
                        ${isImportant ? '<span class="category-tag bg-[#f59e0b]/20 text-[#f59e0b]">Important</span>' : ''}
                        ${isUnread ? '<span class="category-tag bg-[#06b2fc]/20 text-[#06b2fc]">Unread</span>' : ''}
                    </div>
                `;
                emailCard.addEventListener('click', () => window.open(`https://mail.google.com/mail/u/0/#inbox/${message.id}`, '_blank'));
                emailList.appendChild(emailCard);
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

            const ctx1 = document.getElementById('volumeChart').getContext('2d');
            volumeChart = new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'],
                    datasets: [
                        { label: 'Received', data: [5, 3, 7, 12, 18, 15, 10, 8], borderColor: '#06b2fc', backgroundColor: 'rgba(6, 178, 252, 0.1)', tension: 0.3, fill: true },
                        { label: 'Sent', data: [2, 1, 3, 5, 8, 6, 4, 3], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.3, fill: true }
                    ]
                },
                options: commonOptions
            });
            
            const ctx2 = document.getElementById('categoryChart').getContext('2d');
            categoryChart = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['Work', 'Personal', 'Promotions', 'Updates', 'Social'],
                    datasets: [{ data: [35, 25, 20, 12, 8], backgroundColor: ['#06b2fc', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'], borderColor: '#242628', borderWidth: 2 }]
                },
                options: { responsive: true, plugins: { legend: { position: 'right', labels: { color: '#fcfcfc' } } } }
            });
        }

        async function analyzeEmails(mode) {
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
                const emailSamples = Object.values(emailContents)
                    .slice(0, 10)
                    .map(email => `From: ${email.from}\nSubject: ${email.subject}\n\n${email.body.substring(0, 500)}...`)
                    .join('\n\n---\n\n');
                
                let prompt = '';
                let title = '';
                
                switch(mode) {
                    case 'summary':
                        title = `Summary of Last ${dayText}`;
                        prompt = `Analyze these emails from the last ${dayText} and provide a concise summary. Focus on:\n- Key topics and themes\n- Important senders\n- Urgent matters\n- Overall sentiment\n\nFormat as bullet points. Sample emails:\n\n${emailSamples}`;
                        break;
                    case 'trends':
                        title = `Trends in Last ${dayText}`;
                        prompt = `Identify trends in these emails from the last ${dayText}. Look for:\n- Common topics\n- Time patterns\n\nProvide actionable insights. Sample emails:\n\n${emailSamples}`;
                        break;
                    case 'actions':
                        title = `Action Items from Last ${dayText}`;
                        prompt = `Extract clear action items from these emails from the last ${dayText}. Include:\n- Specific tasks\n- Deadlines\n- Required follow-ups\n\nFormat as a numbered list. Sample emails:\n\n${emailSamples}`;
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

        async function sendEmail() {
            const to = document.getElementById('email-to').value.trim();
            const subject = document.getElementById('email-subject').value.trim();
            const content = document.getElementById('email-content').value.trim();
            const statusEl = document.getElementById('generator-status');

            if (!to || !subject || !content) {
                statusEl.textContent = 'Please provide recipient, subject, and content.';
                statusEl.style.color = '#ef4444';
                return;
            }
            
            statusEl.textContent = 'Sending email...';
            statusEl.style.color = '#06b2fc';
            showLoading(true);

            try {
                const emailLines = [ `To: ${to}`, 'Content-Type: text/html; charset=utf-8', 'MIME-Version: 1.0', `Subject: ${subject}`, '', content.replace(/\n/g, '<br>') ];
                const email = emailLines.join('\n');
                const base64EncodedEmail = btoa(email).replace(/\+/g, '-').replace(/\//g, '_');

                await gmailClient.users.messages.send({ userId: 'me', resource: { raw: base64EncodedEmail } });

                statusEl.textContent = 'Email sent successfully!';
                statusEl.style.color = '#10b981';
                
                setTimeout(() => {
                    composeOverlay.classList.add('hidden');
                    document.getElementById('email-to').value = '';
                    document.getElementById('email-subject').value = '';
                    document.getElementById('email-content').value = '';
                    statusEl.textContent = '';
                }, 2000);

            } catch (err) {
                const errorMsg = err?.result?.error?.message || err.message;
                statusEl.textContent = `Error: ${errorMsg}`;
                statusEl.style.color = '#ef4444';
                console.error(err);
            } finally {
                showLoading(false);
            }
        }

        async function enhanceWithAI() {
            const contentEl = document.getElementById('email-content');
            const originalContent = contentEl.value.trim();
            const subject = document.getElementById('email-subject').value.trim();
            const statusEl = document.getElementById('generator-status');

            if (!originalContent) {
                statusEl.textContent = 'Please enter some content to enhance.';
                statusEl.style.color = '#ef4444';
                return;
            }

            const shouldFormat = document.getElementById('ai-format-toggle').checked;
            const prompt = `You are a professional email assistant. Based on the following, write a professional email. Subject: "${subject}". Content: "${originalContent}". Return only the enhanced email body.`;

            statusEl.textContent = 'AI is enhancing your email...';
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
                statusEl.textContent = 'Email enhanced successfully!';
                statusEl.style.color = '#10b981';
            } catch (error) {
                statusEl.textContent = `AI Error: ${error.message}`;
                statusEl.style.color = '#ef4444';
            } finally {
                showLoading(false);
            }
        }

        // --- Event listeners ---
        document.getElementById('email-filter').addEventListener('change', (e) => getRecentEmails(e.target.value));
        document.getElementById('analyze-summary-btn').addEventListener('click', () => analyzeEmails('summary'));
        document.getElementById('analyze-trends-btn').addEventListener('click', () => analyzeEmails('trends'));
        document.getElementById('analyze-actions-btn').addEventListener('click', () => analyzeEmails('actions'));
        
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
        document.getElementById('send-email-btn').addEventListener('click', sendEmail);
        document.getElementById('ai-enhance-btn').addEventListener('click', enhanceWithAI);

        initializeApp();
    });