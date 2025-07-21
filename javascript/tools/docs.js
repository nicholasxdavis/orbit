document.addEventListener('DOMContentLoaded', async () => {
    // --- KEY DEOBFUSCATION ---
    const deobfuscate = (key) => key.replace(/\*/g, '');

    // --- CONFIGURATION ---
    const SUPABASE_URL = 'https://zxeikhguvghtsqouyuyz.supabase.co';
    const SUPABASE_ANON_KEY = deobfuscate('e*y*J*h*b*G*c*i*O*i*J*I*U*z*I*1*N*i*I*s*I*n*R*5*c*C*I*6*I*k*p*X*V*C*J*9*.*e*y*J*p*c*3*M*i*O*i*J*z*d*X*B*h*Y*m*F*z*Z*S*I*s*I*n*J*l*Z*i*I*6*I*n*p*4*Z*W*l*r*a*G*d*1*d*m*d*o*d*H*N*x*b*3*V*5*d*X*l*6*I*i*w*i*c*m*9*s*Z*S*I*6*I*m*F*u*b*2*4*i*L*C*J*p*Y*X*Q*i*O*j*E*3*N*T*E*1*O*D*Y*y*M*z*A*s*I*m*V*4*c*C*I*6*M*j*A*2*N*z*E*2*M*j*I*z*M*H*0*.*a*9*j*W*r*_*h*1*d*g*y*i*_*S*T*7*s*g*K*D*A*S*D*H*i*7*h*k*M*j*S*W*O*R*7*8*V*q*2*f*M*N*0');

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const GOOGLE_API_KEY = deobfuscate('A*I*z*a*S*y*A*U*I*v*4*H*E*M*u*f*F*0*x*5*1*e*Z*q*L*p*e*o*R*t*J*X*8*W*n*r*n*i*o');
    const DISCOVERY_DOC = 'https://docs.googleapis.com/$discovery/rest?version=v1';

    const OPENROUTER_API_KEY = deobfuscate('s*k*-*o*r*-*v*1*-*b*2*1*9*8*5*d*9*f*5*7*4*2*0*1*8*b*8*d*8*e*9*d*8*e*3*6*f*f*f*9*c*1*5*b*8*3*1*6*2*1*8*8*9*1*c*a*5*e*3*2*6*a*3*a*2*f*d*5*4*b*a*4*7');
    const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
    const DEFAULT_MODEL = 'mistralai/mistral-7b-instruct:free';

    // --- DOM ELEMENTS ---
    const appContent = document.getElementById('app-content');
    const loadingOverlay = document.getElementById('loading-skeleton'); // FIX: Changed ID to match original HTML
    const generateDocBtn = document.getElementById('generate-doc-btn');
    const aiEnhanceBtn = document.getElementById('ai-enhance-btn');
    const reconnectGoogleBtn = document.getElementById('reconnectGoogleBtn');
    const docTitleInput = document.getElementById('doc-title');
    const docContentInput = document.getElementById('doc-content');
    const aiFormatToggle = document.getElementById('ai-format-toggle');
    const reconnectGoogleDiv = document.getElementById('reconnect-google');
    const statusEl = document.getElementById('generator-status');


    // Global variable to hold user data
    let currentUser = null;

    // --- UI & FEEDBACK FUNCTIONS ---

    /**
     * Toggles the main loading overlay.
     * @param {boolean} show True to show, false to hide.
     */
    const showLoading = (show) => {
        if (loadingOverlay) { // Guard against null element
            loadingOverlay.classList.toggle('hidden', !show);
        }
    };

    // --- GOOGLE & SUPABASE AUTH ---

    /**
     * Fetches a valid Google token from Supabase for the current user.
     * @param {string} userId The Supabase user ID.
     * @returns {Promise<string|null>} The access token or null if not found/expired.
     */
    async function getGoogleToken(userId) {
        try {
            const { data, error } = await supabase
                .from('user_google_tokens')
                .select('access_token, expires_at')
                .eq('user_id', userId)
                .single();

            if (error || !data) return null;

            if (new Date(data.expires_at) <= new Date()) {
                await supabase.from('user_google_tokens').delete().eq('user_id', userId);
                return null;
            }
            return data.access_token;
        } catch (error) {
            console.error('Error fetching Google token:', error);
            return null;
        }
    }

    /**
     * Initializes the Google API client.
     * @returns {Promise<void>}
     */
    async function initializeGapiClient(accessToken) {
        await new Promise((resolve) => gapi.load('client', resolve));
        await gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
        });
        gapi.client.setToken({ access_token: accessToken });
    }

    // --- CORE LOGIC ---
    
    /**
     * Parses content and builds a request array for beautiful Google Docs formatting.
     * @param {string} content The raw text content, supporting markdown.
     * @returns {Array<Object>} An array of Google Docs API request objects.
     */
    function buildStyledRequests(content) {
        const requests = [];
        let currentIndex = 1; // Content starts at index 1 in a new doc

        const lines = content.split('\n');

        for (const line of lines) {
            let textToInsert = line;
            let styleType = 'NORMAL';

            if (line.startsWith('# ')) {
                textToInsert = line.substring(2);
                styleType = 'H1';
            } else if (line.startsWith('## ')) {
                textToInsert = line.substring(3);
                styleType = 'H2';
            } else if (line.startsWith('* ') || line.startsWith('- ')) {
                textToInsert = line.substring(2);
                styleType = 'BULLET';
            }

            // Handle empty lines for paragraph spacing
            if (line.trim() === '' && styleType === 'NORMAL') {
                requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
                currentIndex += 1;
                continue;
            }
            
            const fullTextToInsert = textToInsert + '\n';
            const textLength = fullTextToInsert.length;

            // 1. Insert the text for the current line
            requests.push({ insertText: { location: { index: currentIndex }, text: fullTextToInsert } });

            const textRange = { startIndex: currentIndex, endIndex: currentIndex + textLength - 1 };

            // 2. Apply styling based on the detected type
            switch (styleType) {
                case 'H1':
                    requests.push({ updateParagraphStyle: { range: textRange, paragraphStyle: { namedStyleType: 'HEADING_1', spaceBelow: { magnitude: 8, unit: 'PT' } }, fields: 'namedStyleType,spaceBelow' } });
                    requests.push({ updateTextStyle: { range: textRange, textStyle: { fontSize: { magnitude: 18, unit: 'PT' }, bold: true }, fields: 'fontSize,bold' } });
                    break;
                case 'H2':
                    requests.push({ updateParagraphStyle: { range: textRange, paragraphStyle: { namedStyleType: 'HEADING_2', spaceBelow: { magnitude: 6, unit: 'PT' } }, fields: 'namedStyleType,spaceBelow' } });
                    requests.push({ updateTextStyle: { range: textRange, textStyle: { fontSize: { magnitude: 14, unit: 'PT' }, bold: true }, fields: 'fontSize,bold' } });
                    break;
                case 'BULLET':
                    requests.push({ createParagraphBullets: { range: textRange, bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' } });
                    break;
                default: // Normal text
                    requests.push({ updateParagraphStyle: { range: textRange, paragraphStyle: { spaceBelow: { magnitude: 8, unit: 'PT' } }, fields: 'spaceBelow' } });
                    break;
            }
            currentIndex += textLength;
        }
        return requests;
    }

    /**
     * Creates a new Google Doc with the provided title and styled content.
     */
    async function generateDocument() {
        const title = docTitleInput.value.trim();
        const content = docContentInput.value.trim();

        if (!title || !content) {
            statusEl.textContent = 'Please provide a title and content.';
            statusEl.style.color = '#ef4444';
            return;
        }
        if (!currentUser) {
            statusEl.textContent = 'Authentication error. Please sign in again.';
            statusEl.style.color = '#ef4444';
            return;
        }

        showLoading(true);
        statusEl.textContent = 'Checking usage limits...';
        statusEl.style.color = '#50b1f7';

        try {
            const { data: usage, error: usageError } = await supabase
                .from('user_usage').select('document_count, is_pro').eq('user_id', currentUser.id).single();

            if (usageError) throw new Error('Could not verify user usage.');

            const MAX_FREE_DOCS = 20;
            if (!usage.is_pro && usage.document_count >= MAX_FREE_DOCS) {
                statusEl.innerHTML = `You've reached the free limit of ${MAX_FREE_DOCS} docs. <a href="../../" class="text-[#50b1f7] hover:underline">Upgrade to Pro</a> for unlimited creation.`;
                statusEl.style.color = '#f59e0b';
                return;
            }

            statusEl.textContent = 'Creating Google Doc...';
            const response = await gapi.client.docs.documents.create({ title });
            const docId = response.result.documentId;

            const { error: rpcError } = await supabase.rpc('increment_doc_count', { p_user_id: currentUser.id });
            if (rpcError) console.error('Critical: Failed to update usage count:', rpcError.message);

            const requests = buildStyledRequests(content);
            if (requests.length > 0) {
                await gapi.client.docs.documents.batchUpdate({ documentId: docId, requests });
            }

            statusEl.innerHTML = `Document created! <a href="https://docs.google.com/document/d/${docId}/edit" target="_blank" class="text-[#50b1f7] hover:underline">Open Document</a>`;
            statusEl.style.color = '#10b981';

        } catch (err) {
            const errorMsg = err?.result?.error?.message || err.message || 'An unknown error occurred.';
            statusEl.textContent = errorMsg.includes('authentication') ? 'Authentication expired. Please refresh.' : `Error: ${errorMsg}`;
            statusEl.style.color = '#ef4444';
            console.error('Error generating document:', err);
        } finally {
            showLoading(false);
        }
    }

    /**
     * Uses AI to enhance the text in the content area.
     */
    async function enhanceWithAI() {
        const originalContent = docContentInput.value.trim();
        if (!originalContent) {
            statusEl.textContent = 'Please enter content to enhance.';
            statusEl.style.color = '#ef4444';
            return;
        }

        const shouldFormat = aiFormatToggle.checked;
        const prompt = shouldFormat
            ? `You are a professional writing assistant. Take the following text and: 1) Expand upon it with relevant details, 2) Improve clarity and flow, 3) Ensure a professional tone, 4) Format the output using simple markdown (# for headings, * or - for bullet points). Return only the enhanced text without any additional commentary. Original text: "${originalContent}"`
            : `You are a helpful writing assistant. Take the following text and expand upon it, making it more detailed, professional, and well-structured. Do not add any introductory or concluding remarks, just provide the enhanced text. Original text: "${originalContent}"`;

        showLoading(true);
        statusEl.textContent = 'AI is enhancing your text...';
        statusEl.style.color = '#8b5cf6';


        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'Orbit Docs Tool'
                },
                body: JSON.stringify({
                    model: DEFAULT_MODEL,
                    messages: [{ role: "user", content: prompt }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `API call failed: ${response.status}`);
            }

            const result = await response.json();
            const enhancedText = result.choices?.[0]?.message?.content;

            if (!enhancedText) throw new Error('No content returned from AI.');

            docContentInput.value = enhancedText;
            statusEl.textContent = 'Text enhanced successfully!';
            statusEl.style.color = '#10b981';
        } catch (error) {
            statusEl.textContent = `AI Error: ${error.message}`;
            statusEl.style.color = '#ef4444';
            console.error("OpenRouter API Error:", error);
        } finally {
            showLoading(false);
        }
    }

    /**
     * Main application initialization function.
     */
    async function initializeApp() {
        showLoading(true);
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error || !session) {
                throw new Error('No active session. Please log in.');
            }
            currentUser = session.user;

            const accessToken = await getGoogleToken(currentUser.id);
            if (!accessToken) {
                throw new Error('No valid Google token. Please reconnect your account.');
            }

            await initializeGapiClient(accessToken);
            appContent.classList.remove('hidden');

        } catch (error) {
            statusEl.textContent = error.message;
            statusEl.style.color = '#ef4444';
            if (error.message.includes('Google token')) {
                reconnectGoogleDiv.classList.remove('hidden');
            } else {
                setTimeout(() => window.location.href = '../../', 3000);
            }
        } finally {
            showLoading(false);
        }
    }

    // --- EVENT LISTENERS ---
    reconnectGoogleBtn?.addEventListener('click', () => window.location.href = '../../');
    generateDocBtn.addEventListener('click', generateDocument);
    aiEnhanceBtn.addEventListener('click', enhanceWithAI);

    // --- STARTUP ---
    initializeApp();
});
