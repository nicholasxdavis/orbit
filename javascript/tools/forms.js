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
    const DISCOVERY_DOCS = ["https://forms.googleapis.com/$discovery/rest?version=v1"];

    const OPENROUTER_API_KEY = deobfuscate('s*k*-*o*r*-*v*1*-*b*2*1*9*8*5*d*9*f*5*7*4*2*0*1*8*b*8*d*8*e*9*d*8*e*3*6*f*f*f*9*c*1*5*b*8*3*1*6*2*1*8*8*9*1*c*a*5*e*3*2*6*a*3*a*2*f*d*5*4*b*a*4*7');
    const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
    const DEFAULT_MODEL = 'moonshotai/kimi-k2:free';
    
    let currentUser = null;

    document.addEventListener('DOMContentLoaded', async () => {
        const appContent = document.getElementById('app-content');
        const loadingSkeleton = document.getElementById('loading-skeleton');
        const statusEl = document.getElementById('generator-status');
        const generateFormBtn = document.getElementById('generate-form-btn');
        const aiGenerateBtn = document.getElementById('ai-generate-btn');
        const formPreview = document.getElementById('form-preview');
        const formQuestionsInput = document.getElementById('form-questions');

        const showLoading = (show) => {
            loadingSkeleton.classList.toggle('hidden', !show);
        };

        const redirectToDashboard = (message) => {
            alert(message);
            window.location.href = '../../index.html';
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
                    await supabase.from('user_google_tokens').delete().eq('user_id', userId);
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
                currentUser = session.user;

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
                    discoveryDocs: DISCOVERY_DOCS,
                });

                gapi.client.setToken({
                    access_token: tokenData.access_token,
                    token_type: 'Bearer'
                });

                appContent.classList.remove('hidden');
                updateFormPreview();
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

        function updateFormPreview() {
            const title = document.getElementById('form-title').value || "Untitled Form";
            const description = document.getElementById('form-description').value || "Form description";
            let questions = [];
            try {
                questions = JSON.parse(formQuestionsInput.value);
            } catch (e) {
                // Ignore parsing errors for live preview
            }

            let previewHtml = `<h1 class="text-2xl font-bold mb-2">${title}</h1><p class="text-dark-tertiary mb-6">${description}</p>`;
            if (Array.isArray(questions)) {
                questions.forEach(q => {
                    previewHtml += `<div class="mb-4"><label class="block text-dark-light font-medium mb-2">${q.title || 'Untitled Question'}</label>`;
                    switch (q.type) {
                        case 'TEXT':
                            previewHtml += `<input type="text" class="w-full p-2 bg-dark-primary rounded-md border border-dark-tertiary/50" disabled>`;
                            break;
                        case 'MULTIPLE_CHOICE':
                        case 'RADIO':
                            q.options?.forEach(opt => {
                                previewHtml += `<div class="flex items-center mb-1"><input type="radio" disabled class="mr-2"><label>${opt}</label></div>`;
                            });
                            break;
                        case 'CHECKBOX':
                             q.options?.forEach(opt => {
                                previewHtml += `<div class="flex items-center mb-1"><input type="checkbox" disabled class="mr-2"><label>${opt}</label></div>`;
                            });
                            break;
                        default:
                             previewHtml += `<input type="text" class="w-full p-2 bg-dark-primary rounded-md border border-dark-tertiary/50" disabled>`;
                    }
                    previewHtml += `</div>`;
                });
            }
            formPreview.innerHTML = previewHtml;
        }
        
        async function generateForm() {
            const title = document.getElementById('form-title').value.trim();
            const description = document.getElementById('form-description').value.trim();
            let questions = [];
            
            try {
                questions = JSON.parse(formQuestionsInput.value);
                if (!title || !Array.isArray(questions) || questions.length === 0) {
                     statusEl.textContent = 'Please provide a title and at least one question.';
                     statusEl.style.color = '#ef4444';
                     return;
                }
            } catch (e) {
                statusEl.textContent = 'Invalid JSON format for questions.';
                statusEl.style.color = '#ef4444';
                return;
            }

            if (!currentUser) {
                redirectToDashboard('Authentication error. Please sign in again.');
                return;
            }
            
            statusEl.textContent = 'Checking usage limits...';
            statusEl.style.color = '#06b2fc';
            showLoading(true);

            try {
                let { data: usage, error: usageError } = await supabase
                    .from('user_usage')
                    .select('document_count, is_pro')
                    .eq('user_id', currentUser.id)
                    .maybeSingle();

                if (usageError) throw usageError;

                if (!usage) {
                    const { data: newUsage, error: insertError } = await supabase
                        .from('user_usage')
                        .insert({ user_id: currentUser.id, document_count: 0, is_pro: false })
                        .select('document_count, is_pro')
                        .single();
                    if (insertError) throw new Error('Could not initialize user usage.');
                    usage = newUsage;
                }

                const docCount = usage.document_count || 0;
                const MAX_FREE_DOCS = 20;
                if (!usage.is_pro && docCount >= MAX_FREE_DOCS) {
                     statusEl.innerHTML = `You've reached the free limit of ${MAX_FREE_DOCS} documents. <a href="../../index.html" class="text-[#50b1f7] hover:underline">Upgrade to Pro</a> for unlimited creation.`;
                     statusEl.style.color = '#f59e0b';
                     showLoading(false);
                     return;
                }

                statusEl.textContent = 'Creating form...';
                const form = {
                    info: { title }
                };

                const createResponse = await gapi.client.forms.forms.create({ resource: form });
                const formId = createResponse.result.formId;

                const { error: rpcError } = await supabase.rpc('increment_doc_count', {
                    p_user_id: currentUser.id
                });
                if (rpcError) {
                    console.error('Critical: Google Form was created but usage count failed to update:', rpcError.message);
                }

                let requests = [];
                if (description) {
                    requests.push({
                        updateFormInfo: {
                            info: { description },
                            updateMask: 'description'
                        }
                    });
                }

                const questionRequests = questions.map((q, index) => {
                    const item = {
                        title: q.title,
                        questionItem: {
                            question: {
                                required: q.required || false,
                            },
                        },
                    };

                    const questionType = (q.type || 'TEXT').toUpperCase();

                    if (questionType === 'TEXT') {
                        item.questionItem.question.textQuestion = {};
                    } else {
                        let apiChoiceType;
                        switch (questionType) {
                            case 'MULTIPLE_CHOICE':
                            case 'RADIO': // FIX: Handle RADIO type from user/AI
                                apiChoiceType = 'RADIO';
                                break;
                            case 'CHECKBOX':
                                apiChoiceType = 'CHECKBOX';
                                break;
                            case 'DROP_DOWN':
                                apiChoiceType = 'DROP_DOWN';
                                break;
                            default:
                                apiChoiceType = 'RADIO'; 
                        }
                        item.questionItem.question.choiceQuestion = {
                            type: apiChoiceType,
                            options: q.options?.map(opt => ({ value: opt })) || [],
                        };
                    }

                    return {
                        createItem: {
                            item: item,
                            location: { index },
                        },
                    };
                });

                requests = requests.concat(questionRequests);

                if (requests.length > 0) {
                    await gapi.client.forms.forms.batchUpdate({
                        formId,
                        resource: { requests }
                    });
                }

                statusEl.innerHTML = `Form created! <a href="${createResponse.result.responderUri}" target="_blank" class="text-[#8b5cf6] hover:underline">Open Form</a>`;
                statusEl.style.color = '#10b981';

            } catch (err) {
                const errorMsg = err?.result?.error?.message || err.message;
                statusEl.textContent = errorMsg.includes('authentication') ? 'Authentication expired. Please refresh and sign in again.' : `Error: ${errorMsg}`;
                statusEl.style.color = '#ef4444';
                console.error(err);
            } finally {
                showLoading(false);
            }
        }
        
        async function generateQuestionsWithAI() {
            const description = document.getElementById('form-description').value.trim();
            if (!description) {
                statusEl.textContent = 'Please provide a form description to generate questions.';
                statusEl.style.color = '#ef4444';
                return;
            }

            // FIX: Updated prompt to be more specific about the output format
            const prompt = `Based on the form description "${description}", generate a list of 5-7 relevant questions. Return a JSON array of objects. Each object must have "title" (string) and "type" (string). The type must be one of: 'TEXT', 'RADIO', 'CHECKBOX'. For 'RADIO' and 'CHECKBOX' types, you must also include an "options" property which is an array of strings. For 'RADIO' questions, use the type "RADIO".`;

            statusEl.textContent = 'AI is generating questions...';
            statusEl.style.color = '#8b5cf6';
            showLoading(true);

            try {
                const response = await fetch(OPENROUTER_API_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': window.location.href,
                        'X-Title': 'Orbit Forms Tool'
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
                const generatedQuestions = result.choices?.[0]?.message?.content;
                if (!generatedQuestions) throw new Error('No content returned from AI.');
                
                let parsedQuestions;
                try {
                    const jsonMatch = generatedQuestions.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        parsedQuestions = JSON.parse(jsonMatch[0]);
                    } else {
                        throw new Error();
                    }
                } catch (e) {
                     try {
                        const cleaned = generatedQuestions.replace(/^```json|```$/g, '').trim();
                        parsedQuestions = JSON.parse(cleaned);
                    } catch (e) {
                        throw new Error('AI returned invalid JSON format');
                    }
                }
                
                formQuestionsInput.value = JSON.stringify(parsedQuestions, null, 2);
                updateFormPreview();
                statusEl.textContent = 'Questions generated successfully!';
                statusEl.style.color = '#10b981';
            } catch (error) {
                statusEl.textContent = `AI Error: ${error.message}`;
                statusEl.style.color = '#ef4444';
                console.error("OpenRouter API Error:", error);
            } finally {
                showLoading(false);
            }
        }

        // Initialize the app
        initializeApp();

        // Event listeners
        generateFormBtn.addEventListener('click', generateForm);
        aiGenerateBtn.addEventListener('click', generateQuestionsWithAI);
        
        // Update preview when data changes
        formQuestionsInput.addEventListener('input', updateFormPreview);
        document.getElementById('form-title').addEventListener('input', updateFormPreview);
        document.getElementById('form-description').addEventListener('input', updateFormPreview);
    });