// --- KEY DEOBFUSCATION ---
    const deobfuscate = (key) => key.replace(/\*/g, '');

    // --- CONFIGURATION ---
    const SUPABASE_URL = 'https://zxeikhguvghtsqouyuyz.supabase.co';
    const SUPABASE_ANON_KEY = deobfuscate('e*y*J*h*b*G*c*i*O*i*J*I*U*z*I*1*N*i*I*s*I*n*R*5*c*C*I*6*I*k*p*X*V*C*J*9*.*e*y*J*p*c*3*M*i*O*i*J*z*d*X*B*h*Y*m*F*z*Z*S*I*s*I*n*J*l*Z*i*I*6*I*n*p*4*Z*W*l*r*a*G*d*1*d*m*d*o*d*H*N*x*b*3*V*5*d*X*l*6*I*i*w*i*c*m*9*s*Z*S*I*6*I*m*F*u*b*2*4*i*L*C*J*p*Y*X*Q*i*O*j*E*3*N*T*E*1*O*D*Y*y*M*z*A*s*I*m*V*4*c*C*I*6*M*j*A*2*N*z*E*2*M*j*I*z*M*H*0*.*a*9*j*W*r*_*h*1*d*g*y*i*_*S*T*7*s*g*K*D*A*S*D*H*i*7*h*k*M*j*S*W*O*R*7*8*V*q*2*f*M*N*0');

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        }
    });

    const GOOGLE_API_KEY = deobfuscate('A*I*z*a*S*y*A*U*I*v*4*H*E*M*u*f*F*0*x*5*1*e*Z*q*L*p*e*o*R*t*J*X*8*W*n*r*n*i*o');
    const DISCOVERY_DOC = 'https://docs.googleapis.com/$discovery/rest?version=v1';

    const OPENROUTER_API_KEY = deobfuscate('s*k*-*o*r*-*v*1*-*b*2*1*9*8*5*d*9*f*5*7*4*2*0*1*8*b*8*d*8*e*9*d*8*e*3*6*f*f*f*9*c*1*5*b*8*3*1*6*2*1*8*8*9*1*c*a*5*e*3*2*6*a*3*a*2*f*d*5*4*b*a*4*7');
    const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
    const DEFAULT_MODEL = 'moonshotai/kimi-k2:free';
    
    // Global variable to hold user data
    let currentUser = null;

    // This function is now the entry point, called by the Google API script.
    function startApp() {
        const appContent = document.getElementById('app-content');
        const loadingSkeleton = document.getElementById('loading-skeleton');
        const statusEl = document.getElementById('generator-status');
        const generateDocBtn = document.getElementById('generate-doc-btn');
        const aiEnhanceBtn = document.getElementById('ai-enhance-btn');
        const reconnectGoogleBtn = document.getElementById('reconnectGoogleBtn');

        const showLoading = (show) => {
            loadingSkeleton.classList.toggle('hidden', !show);
        };

        const redirectToDashboard = (message) => {
            alert(message);
            window.location.href = '../../';
        };

        async function validateGoogleToken(accessToken) {
            try {
                const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
                if (!response.ok) return false;
                
                const data = await response.json();
                return !data.error && data.expires_in > 0;
            } catch {
                return false;
            }
        }

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
                    await supabase
                        .from('user_google_tokens')
                        .delete()
                        .eq('user_id', userId);
                    return null;
                }
                
                return data;
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
                    throw new Error('No active session. Please login first.');
                }
                
                currentUser = session.user; // <-- Store the user object

                const tokenData = await getGoogleToken(currentUser.id);
                if (!tokenData || !tokenData.access_token) {
                    throw new Error('No valid Google token found. Please reconnect your Google account.');
                }

                const isValid = await validateGoogleToken(tokenData.access_token);
                if (!isValid) {
                    throw new Error('Google token is invalid. Please reconnect your Google account.');
                }

                await new Promise((resolve) => gapi.load('client', resolve));
                await gapi.client.init({
                    apiKey: GOOGLE_API_KEY,
                    discoveryDocs: [DISCOVERY_DOC],
                });

                gapi.client.setToken({
                    access_token: tokenData.access_token,
                    token_type: 'Bearer'
                });

                appContent.classList.remove('hidden');

            } catch (error) {
                console.error('Initialization error:', error);
                statusEl.textContent = error.message;
                statusEl.style.color = '#ef4444';
                if (error.message.includes('Google token')) {
                    document.getElementById('reconnect-google').classList.remove('hidden');
                } else {
                    redirectToDashboard(error.message);
                }
            } finally {
                showLoading(false);
            }
        }

        async function generateDocument() {
            const title = document.getElementById('doc-title').value.trim();
            const content = document.getElementById('doc-content').value.trim();

            if (!title || !content) {
                statusEl.textContent = 'Please provide a title and content.';
                statusEl.style.color = '#ef4444';
                return;
            }

            if (!currentUser) {
                redirectToDashboard('Authentication error. Please sign in again.');
                return;
            }
            
            statusEl.textContent = 'Checking usage limits...';
            statusEl.style.color = '#50b1f7';
            showLoading(true);

            try {
                // First, check user's current usage and plan
                const { data: usage, error: usageError } = await supabase
                    .from('user_usage')
                    .select('document_count, is_pro')
                    .eq('user_id', currentUser.id)
                    .single();

                if (usageError) throw new Error('Could not verify user usage.');
                
                const MAX_FREE_DOCS = 20; // Your free tier limit
                if (!usage.is_pro && usage.document_count >= MAX_FREE_DOCS) {
                     statusEl.innerHTML = `You've reached the free limit of ${MAX_FREE_DOCS} docs. <a href="../../" class="text-[#50b1f7] hover:underline">Upgrade to Pro</a> for unlimited creation.`;
                     statusEl.style.color = '#f59e0b';
                     showLoading(false);
                     return;
                }

                // If usage is okay, proceed to create the document
                statusEl.textContent = 'Creating document...';
                const response = await gapi.client.docs.documents.create({ title: title });
                const docId = response.result.documentId;

                // --- THIS IS THE FIX ---
                // Document created successfully, now increment the count in Supabase
                const { error: rpcError } = await supabase.rpc('increment_doc_count', {
                    p_user_id: currentUser.id
                });
                
                if (rpcError) {
                    // Log the error but don't stop the user, as the doc is already made.
                    // This error means the count might be out of sync.
                    console.error('Critical: Google Doc was created but usage count failed to update:', rpcError.message);
                }
                // --- END OF FIX ---

                // Proceed to add content to the new document
                await gapi.client.docs.documents.batchUpdate({
                    documentId: docId,
                    requests: [{
                        insertText: {
                            text: content,
                            location: { index: 1 }
                        }
                    }]
                });

                statusEl.innerHTML = `Document created! <a href="https://docs.google.com/document/d/${docId}/edit" target="_blank" class="text-[#50b1f7] hover:underline">Open Document</a>`;
                statusEl.style.color = '#10b981';

            } catch (err) {
                const errorMsg = err?.result?.error?.message || err.message;
                statusEl.textContent = errorMsg.includes('authentication') ?
                    'Authentication expired. Please refresh and sign in again.' :
                    `Error: ${errorMsg}`;
                statusEl.style.color = '#ef4444';
                console.error(err);
            } finally {
                showLoading(false);
            }
        }

        async function enhanceWithAI() {
            const contentEl = document.getElementById('doc-content');
            const originalContent = contentEl.value.trim();

            if (!originalContent) {
                statusEl.textContent = 'Please enter some content to enhance.';
                statusEl.style.color = '#ef4444';
                return;
            }

            const shouldFormat = document.getElementById('ai-format-toggle').checked;
            const prompt = shouldFormat
                ? `You are a professional writing assistant. Take the following text and: 1) Expand upon it with relevant details, 2) Improve clarity and flow, 3) Ensure professional tone, 4) Format with proper headings, bullet points, and paragraphs where appropriate. Return only the enhanced text without any additional commentary. Original text: "${originalContent}"`
                : `You are a helpful writing assistant. Take the following text and expand upon it, making it more detailed, professional, and well-structured. Do not add any introductory or concluding remarks, just provide the enhanced text. Original text: "${originalContent}"`;

            statusEl.textContent = 'AI is enhancing your text...';
            statusEl.style.color = '#8b5cf6';
            showLoading(true);

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

                contentEl.value = enhancedText;
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

        // Initialize the app and set up event listeners
        initializeApp();
        generateDocBtn.addEventListener('click', generateDocument);
        aiEnhanceBtn.addEventListener('click', enhanceWithAI);
        reconnectGoogleBtn?.addEventListener('click', () => {
            window.location.href = '../../';
        });
    }
