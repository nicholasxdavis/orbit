document.addEventListener('DOMContentLoaded', async () => {
    // --- KEY DEOBFUSCATION ---
    const deobfuscate = (key) => key.replace(/\*/g, '');

    // --- CONFIGURATION ---
    const SUPABASE_URL = 'https://zxeikhguvghtsqouyuyz.supabase.co';
    const SUPABASE_ANON_KEY = deobfuscate('e*y*J*h*b*G*c*i*O*i*J*I*U*z*I*1*N*i*I*s*I*n*R*5*c*C*I*6*I*k*p*X*V*C*J*9*.*e*y*J*p*c*3*M*i*O*i*J*z*d*X*B*h*Y*m*F*z*Z*S*I*s*I*n*J*l*Z*i*I*6*I*n*p*4*Z*W*l*r*a*G*d*1*d*m*d*o*d*H*N*x*b*3*V*5*d*X*l*6*I*i*w*i*c*m*9*s*Z*S*I*6*I*m*F*u*b*2*4*i*L*C*J*p*Y*X*Q*i*O*j*E*3*N*T*E*1*O*D*Y*y*M*z*A*s*I*m*V*4*c*C*I*6*M*j*A*2*N*z*E*2*M*j*I*z*M*H*0*.*a*9*j*W*r*_*h*1*d*g*y*i*_*S*T*7*s*g*K*D*A*S*D*H*i*7*h*k*M*j*S*W*O*R*7*8*V*q*2*f*M*N*0');

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const GOOGLE_API_KEY = deobfuscate('A*I*z*a*S*y*A*U*I*v*4*H*E*M*u*f*F*0*x*5*1*e*Z*q*L*p*e*o*R*t*J*X*8*W*n*r*n*i*o');
    const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

    const OPENROUTER_API_KEY = deobfuscate('s*k*-*o*r*-*v*1*-*b*2*1*9*8*5*d*9*f*5*7*4*2*0*1*8*b*8*d*8*e*9*d*8*e*3*6*f*f*f*9*c*1*5*b*8*3*1*6*2*1*8*8*9*1*c*a*5*e*3*2*6*a*3*a*2*f*d*5*4*b*a*4*7');
    const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
    const DEFAULT_MODEL = 'mistralai/mistral-7b-instruct:free';

    // --- DOM ELEMENTS ---
    const appContent = document.getElementById('app-content');
    const loadingOverlay = document.getElementById('loading-skeleton');
    const generateSheetBtn = document.getElementById('generate-sheet-btn'); // Assumes this ID exists in the HTML
    const aiEnhanceBtn = document.getElementById('ai-enhance-btn');
    const reconnectGoogleBtn = document.getElementById('reconnectGoogleBtn');
    const sheetTitleInput = document.getElementById('sheet-title'); // Assumes this ID exists
    const sheetContentInput = document.getElementById('sheet-content'); // Assumes this ID exists
    const aiFormatToggle = document.getElementById('ai-format-toggle');
    const reconnectGoogleDiv = document.getElementById('reconnect-google');
    const statusEl = document.getElementById('generator-status');

    // Global variable to hold user data
    let currentUser = null;

    // --- UI & FEEDBACK FUNCTIONS ---
    const showLoading = (show) => {
        if (loadingOverlay) {
            loadingOverlay.classList.toggle('hidden', !show);
        }
    };

    const redirectToDashboard = (message) => {
        alert(message);
        window.location.href = '../../';
    };

    // --- GOOGLE & SUPABASE AUTH ---
    async function getGoogleToken(userId) {
        try {
            const { data, error } = await supabase.from('user_google_tokens').select('access_token, expires_at').eq('user_id', userId).single();
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

    async function initializeGapiClient(accessToken) {
        await new Promise((resolve) => gapi.load('client', resolve));
        await gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
        });
        gapi.client.setToken({ access_token: accessToken });
    }

    // --- CORE LOGIC ---
    async function generateSpreadsheet() {
        const title = sheetTitleInput.value.trim();
        const content = sheetContentInput.value.trim();

        if (!title || !content) {
            statusEl.textContent = 'Please provide a title and content.';
            statusEl.style.color = '#ef4444';
            return;
        }
        if (!currentUser) {
            redirectToDashboard('Authentication error. Please sign in again.');
            return;
        }

        showLoading(true);
        statusEl.textContent = 'Checking usage limits...';
        statusEl.style.color = '#50b1f7';

        try {
            const { data: usage, error: usageError } = await supabase.from('user_usage').select('document_count, is_pro').eq('user_id', currentUser.id).single();
            if (usageError && usageError.code !== 'PGRST116') throw new Error('Could not verify user usage.');

            const docCount = usage?.document_count || 0;
            const MAX_FREE_DOCS = 20;
            if (!usage?.is_pro && docCount >= MAX_FREE_DOCS) {
                statusEl.innerHTML = `You've reached the free limit of ${MAX_FREE_DOCS} docs. <a href="../../" class="text-[#50b1f7] hover:underline">Upgrade to Pro</a> for unlimited creation.`;
                statusEl.style.color = '#f59e0b';
                showLoading(false);
                return;
            }

            statusEl.textContent = 'Creating spreadsheet...';
            const spreadsheet = await gapi.client.sheets.spreadsheets.create({ properties: { title } });
            const spreadsheetId = spreadsheet.result.spreadsheetId;

            const { error: rpcError } = await supabase.rpc('increment_doc_count', { p_user_id: currentUser.id });
            if (rpcError) console.error('Critical: Failed to update usage count:', rpcError.message);

            let headers = [];
            let dataRows = [];
            try {
                const jsonData = JSON.parse(content);
                if (Array.isArray(jsonData) && jsonData.length > 0) {
                    headers = Object.keys(jsonData[0]);
                    dataRows = jsonData.map(obj => headers.map(header => obj[header] ?? ''));
                }
            } catch (e) {
                const lines = content.split('\n').filter(line => line.trim() !== '');
                const csvData = lines.map(line => line.split(',').map(cell => cell.trim()));
                if (csvData.length > 0) {
                    headers = csvData[0];
                    dataRows = csvData.slice(1);
                }
            }

            if (headers.length === 0) {
                throw new Error("Could not parse any data from the content.");
            }

            const rowData = [
                { values: headers.map(header => ({ userEnteredValue: { stringValue: header } })) },
                ...dataRows.map(row => ({
                    values: row.map(cell => {
                        const num = Number(cell);
                        // FIX: Convert cell to string before trimming to handle numeric types
                        return !isNaN(num) && String(cell).trim() !== '' ? { userEnteredValue: { numberValue: num } } : { userEnteredValue: { stringValue: String(cell) } };
                    })
                }))
            ];
            
            const requests = [
                // 1. Add all data to the sheet
                {
                    updateCells: {
                        rows: rowData,
                        fields: 'userEnteredValue',
                        start: { sheetId: 0, rowIndex: 0, columnIndex: 0 },
                    },
                },
                // 2. Format the header row
                {
                    repeatCell: {
                        range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                                horizontalAlignment: 'CENTER',
                                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 11, bold: true },
                            },
                        },
                        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
                    },
                },
                // 3. Add alternating row colors for data
                {
                    addConditionalFormatRule: {
                        rule: {
                            ranges: [{ sheetId: 0, startRowIndex: 1, endRowIndex: dataRows.length + 1 }],
                            booleanRule: {
                                condition: {
                                    type: 'CUSTOM_FORMULA',
                                    values: [{ userEnteredValue: '=MOD(ROW(),2)=0' }]
                                },
                                format: { backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 } }
                            }
                        },
                        index: 0
                    }
                },
                 // 4. Add borders to all cells
                {
                    updateBorders: {
                        range: { sheetId: 0, startRowIndex: 0, endRowIndex: dataRows.length + 1, startColumnIndex: 0, endColumnIndex: headers.length },
                        top: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
                        bottom: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
                        left: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
                        right: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
                    }
                },
                // 5. Auto-resize columns
                {
                    autoResizeDimensions: {
                        dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: headers.length },
                    },
                },
            ];

            await gapi.client.sheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests } });

            statusEl.innerHTML = `Spreadsheet created! <a href="https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit" target="_blank" class="text-[#50b1f7] hover:underline">Open Spreadsheet</a>`;
            statusEl.style.color = '#10b981';

        } catch (err) {
            const errorMsg = err?.result?.error?.message || err.message;
            statusEl.textContent = errorMsg.includes('authentication') ? 'Authentication expired. Please refresh.' : `Error: ${errorMsg}`;
            statusEl.style.color = '#ef4444';
            console.error(err);
        } finally {
            showLoading(false);
        }
    }

    async function enhanceWithAI() {
        const contentEl = sheetContentInput;
        const originalContent = contentEl.value.trim();
        if (!originalContent) {
            statusEl.textContent = 'Please enter a description to generate data.';
            statusEl.style.color = '#ef4444';
            return;
        }

        const prompt = `You are a professional data assistant. Based on the following description, generate a realistic dataset with appropriate column headers and 10-15 rows of sample data. Format the entire output as a single, clean JSON array of objects where each object represents a row. Return ONLY the raw JSON data without any surrounding text, markdown, or commentary. Description: "${originalContent}"`;

        showLoading(true);
        statusEl.textContent = 'AI is generating your data...';
        statusEl.style.color = '#8b5cf6';

        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'Orbit Sheets Tool'
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
            let enhancedText = result.choices?.[0]?.message?.content;
            if (!enhancedText) throw new Error('No content returned from AI.');

            const jsonMatch = enhancedText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) throw new Error('AI returned invalid data format. Expected a JSON array.');
            
            enhancedText = jsonMatch[0];
            const parsedJson = JSON.parse(enhancedText);
            contentEl.value = JSON.stringify(parsedJson, null, 2);
            statusEl.textContent = 'Data generated successfully!';
            statusEl.style.color = '#10b981';

        } catch (error) {
            statusEl.textContent = `AI Error: ${error.message}`;
            statusEl.style.color = '#ef4444';
            console.error("OpenRouter API Error:", error);
        } finally {
            showLoading(false);
        }
    }

    async function initializeApp() {
        showLoading(true);
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error || !session) throw new Error('No active session. Please log in.');
            
            currentUser = session.user;
            const accessToken = await getGoogleToken(currentUser.id);
            if (!accessToken) throw new Error('No valid Google token. Please reconnect your account.');

            await initializeGapiClient(accessToken);
            if (appContent) appContent.classList.remove('hidden');

        } catch (error) {
            if (statusEl) {
                statusEl.textContent = error.message;
                statusEl.style.color = '#ef4444';
            }
            if (error.message.includes('Google token') && reconnectGoogleDiv) {
                reconnectGoogleDiv.classList.remove('hidden');
            } else {
                setTimeout(() => window.location.href = '../../', 3000);
            }
        } finally {
            showLoading(false);
        }
    }

    // --- EVENT LISTENERS ---
    if (reconnectGoogleBtn) reconnectGoogleBtn.addEventListener('click', () => window.location.href = '../../');
    if (generateSheetBtn) generateSheetBtn.addEventListener('click', generateSpreadsheet);
    if (aiEnhanceBtn) aiEnhanceBtn.addEventListener('click', enhanceWithAI);

    // --- STARTUP ---
    initializeApp();
});
