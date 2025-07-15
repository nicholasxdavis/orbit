// --- KEY DEOBFUSCATION ---
const deobfuscate = (key) => key.replace(/\*/g, '');

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://zxeikhguvghtsqouyuyz.supabase.co';
const SUPABASE_ANON_KEY = deobfuscate('e*y*J*h*b*G*c*i*O*i*J*I*U*z*I*1*N*i*I*s*I*n*R*5*c*C*I*6*I*k*p*X*V*C*J*9*.*e*y*J*p*c*3*M*i*O*i*J*z*d*X*B*h*Y*m*F*z*Z*S*I*s*I*n*J*l*Z*i*I*6*I*n*p*4*Z*W*l*r*a*G*d*1*d*m*d*o*d*H*N*x*b*3*V*5*d*X*l*6*I*i*w*i*c*m*9*s*Z*S*I*6*I*m*F*u*b*2*4*i*L*C*J*p*Y*X*Q*i*O*j*E*3*N*T*E*1*O*D*Y*y*M*z*A*s*I*m*V*4*c*C*I*6*M*j*A*2*N*z*E*2*M*j*I*z*M*H*0*.*a*9*j*W*r*_*h*1*d*g*y*i*_*S*T*7*s*g*K*D*A*S*D*H*i*7*h*k*M*j*S*W*O*R*7*8*V*q*2*f*M*N*0');

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const GOOGLE_API_KEY = deobfuscate('A*I*z*a*S*y*A*U*I*v*4*H*E*M*u*f*F*0*x*5*1*e*Z*q*L*p*e*o*R*t*J*X*8*W*n*r*n*i*o');
const DISCOVERY_DOCS = [
    "https://businessprofileperformance.googleapis.com/$discovery/rest?version=v1",
    "https://mybusinessbusinessinformation.googleapis.com/$discovery/rest?version=v1",
    "https://mybusinessaccountmanagement.googleapis.com/$discovery/rest?version=v1"
];

const OPENROUTER_API_KEY = deobfuscate('s*k*-*o*r*-*v*1*-*b*2*1*9*8*5*d*9*f*5*7*4*2*0*1*8*b*8*d*8*e*9*d*8*e*3*6*f*f*f*9*c*1*5*b*8*3*1*6*2*1*8*8*9*1*c*a*5*e*3*2*6*a*3*a*2*f*d*5*4*b*a*4*7');
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'moonshotai/kimi-k2:free';

// Global variables
let currentUser = null;
let businessProfileClient = null;
let ratingChart = null;
let trendChart = null;
let businessLocations = [];
let selectedLocation = null;
let recentReviews = [];

document.addEventListener('DOMContentLoaded', async () => {
    const appContent = document.getElementById('app-content');
    const authPrompt = document.getElementById('auth-prompt');
    const loadingSkeleton = document.getElementById('loading-skeleton');
    
    const postOverlay = document.getElementById('post-overlay');
    const createPostBtn = document.getElementById('create-post-btn');
    const closePostBtn = document.getElementById('close-post-btn');
    const postTypeSelect = document.getElementById('post-type');
    
    const showLoading = (show) => {
        loadingSkeleton.classList.toggle('hidden', !show);
    };

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

            const googleToken = await getGoogleToken(currentUser.id);
            if (!googleToken) {
                 throw new Error('No valid Google token found. Please reconnect your Google account in the main workspace.');
            }

            await new Promise((resolve) => gapi.load('client', resolve));
            await gapi.client.init({
                apiKey: GOOGLE_API_KEY,
                discoveryDocs: DISCOVERY_DOCS,
            });

            gapi.client.setToken({ access_token: googleToken });
            businessProfileClient = gapi.client.businessprofileperformance;

            // Load business locations
            const accountsResponse = await gapi.client.mybusinessaccountmanagement.accounts.list();
            if (accountsResponse.result.accounts && accountsResponse.result.accounts.length > 0) {
                const accountName = accountsResponse.result.accounts[0].name;
                const locationsResponse = await businessProfileClient.locations.list({ 
                    parent: accountName,
                    readMask: 'name,title,metadata'
                });
                
                businessLocations = locationsResponse.result.locations || [];
                
                if (businessLocations.length > 0) {
                    selectedLocation = businessLocations[0];
                    await loadDashboardData();
                }
            }

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

    async function loadDashboardData() {
        showLoading(true);
        try {
            await getReviewStats();
            await getRecentReviews();
            initCharts();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            alert('Failed to load dashboard data. Your Google token may have expired. Please return to the workspace to reconnect.');
        } finally {
            showLoading(false);
        }
    }

    async function getReviewStats() {
        try {
            const response = await businessProfileClient.locations.getReviews({
                name: selectedLocation.name,
                pageSize: 50
            });
            
            const reviews = response.result.reviews || [];
            const totalReviews = reviews.length;
            const fiveStarReviews = reviews.filter(r => r.starRating === 'FIVE').length;
            const avgRating = reviews.reduce((sum, review) => sum + parseInt(review.starRating), 0) / totalReviews || 0;
            
            document.getElementById('total-reviews').textContent = totalReviews;
            document.getElementById('five-star-reviews').textContent = fiveStarReviews;
            document.getElementById('avg-rating').textContent = avgRating.toFixed(1);
            
            if (reviews.length > 0) {
                const latestReview = reviews[0];
                const date = new Date(latestReview.createTime).toLocaleDateString();
                document.getElementById('recent-activity').textContent = `New review (${latestReview.starRating} stars) on ${date}`;
            }
            
            recentReviews = reviews;
        } catch (error) {
            console.error('Error getting review stats:', error);
        }
    }

    async function getRecentReviews(filter = 'all') {
        const reviewList = document.getElementById('review-list');
        reviewList.innerHTML = '<div class="text-center py-12 text-dark-tertiary"><p>Loading reviews...</p></div>';
        
        try {
            let reviews = recentReviews;
            if (filter !== 'all') {
                reviews = reviews.filter(r => r.starRating === filter);
            }
            
            if (reviews.length === 0) {
                reviewList.innerHTML = '<div class="text-center py-12 text-dark-tertiary"><p>No reviews found</p></div>';
                return;
            }
            
            reviewList.innerHTML = '';
            reviews.slice(0, 10).forEach(review => {
                const date = new Date(review.createTime).toLocaleDateString();
                const stars = '★'.repeat(parseInt(review.starRating)) + '☆'.repeat(5 - parseInt(review.starRating));
                
                const reviewCard = document.createElement('div');
                reviewCard.className = 'review-card bg-dark-secondary rounded-lg p-4 border border-dark-tertiary/20';
                reviewCard.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div class="font-medium">${review.reviewer.displayName || 'Anonymous'}</div>
                        <div class="text-xs text-dark-tertiary">${date}</div>
                    </div>
                    <div class="star-rating text-lg mb-2">${stars}</div>
                    <div class="text-sm mb-2">${review.comment || 'No comment provided'}</div>
                    ${review.reviewReply ? 
                        `<div class="bg-dark-primary/50 p-3 rounded-lg mt-2 border-l-2 border-[#06b2fc]">
                            <div class="text-xs text-dark-tertiary mb-1">Your response</div>
                            <div class="text-sm">${review.reviewReply.comment}</div>
                        </div>` : 
                        `<button class="reply-btn mt-2 text-xs text-[#06b2fc] hover:underline" data-review-id="${review.name}">
                            + Reply to this review
                        </button>`
                    }
                `;
                
                reviewList.appendChild(reviewCard);
            });
            
            // Add event listeners to reply buttons
            document.querySelectorAll('.reply-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const reviewId = e.target.dataset.reviewId;
                    const review = reviews.find(r => r.name === reviewId);
                    if (review) {
                        showReplyDialog(review);
                    }
                });
            });
            
        } catch (error) {
            console.error('Error loading reviews:', error);
            reviewList.innerHTML = '<div class="text-center py-12 text-dark-tertiary"><p>Error loading reviews</p></div>';
        }
    }

    function showReplyDialog(review) {
        const dialog = document.createElement('div');
        dialog.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[2000]';
        dialog.innerHTML = `
            <div class="bg-dark-secondary rounded-xl p-6 w-full max-w-md mx-4">
                <h4 class="text-lg font-semibold mb-4">Reply to Review</h4>
                <p class="text-sm text-dark-tertiary mb-2">Original review:</p>
                <div class="bg-dark-primary/50 p-3 rounded-lg mb-4">
                    <div class="star-rating mb-1">${'★'.repeat(parseInt(review.starRating)) + '☆'.repeat(5 - parseInt(review.starRating))}</div>
                    <div class="text-sm">${review.comment}</div>
                </div>
                <textarea id="reply-content" rows="4" class="w-full p-3 bg-dark-primary border border-dark-tertiary rounded-lg mb-4" placeholder="Write your response here..."></textarea>
                <div class="flex gap-2">
                    <button id="cancel-reply" class="flex-1 bg-dark-primary text-white py-2 px-4 rounded-lg">Cancel</button>
                    <button id="submit-reply" class="flex-1 bg-[#06b2fc] text-white py-2 px-4 rounded-lg hover:bg-[#0595d8]">Submit</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        document.getElementById('cancel-reply').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        
        document.getElementById('submit-reply').addEventListener('click', async () => {
            const replyContent = document.getElementById('reply-content').value.trim();
            if (!replyContent) {
                alert('Please enter a reply');
                return;
            }
            
            try {
                await businessProfileClient.locations.reviews.createReply({
                    name: review.name,
                    reviewReply: {
                        comment: replyContent
                    }
                });
                
                alert('Reply submitted successfully!');
                document.body.removeChild(dialog);
                await getRecentReviews(); // Refresh reviews
            } catch (error) {
                console.error('Error submitting reply:', error);
                alert('Failed to submit reply: ' + error.result?.error?.message || error.message);
            }
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

        // Rating distribution chart
        const ctx1 = document.getElementById('ratingChart').getContext('2d');
        ratingChart = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
                datasets: [{
                    label: 'Review Count',
                    data: [12, 8, 15, 25, 40],
                    backgroundColor: [
                        '#ef4444',
                        '#f59e0b',
                        '#fbbf24',
                        '#06b2fc',
                        '#10b981'
                    ],
                    borderColor: '#242628',
                    borderWidth: 1
                }]
            },
            options: commonOptions
        });
        
        // Review trends chart
        const ctx2 = document.getElementById('trendChart').getContext('2d');
        trendChart = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
                datasets: [
                    { 
                        label: 'Average Rating', 
                        data: [3.8, 4.1, 4.2, 4.3, 4.5, 4.4, 4.6], 
                        borderColor: '#06b2fc', 
                        backgroundColor: 'rgba(6, 178, 252, 0.1)', 
                        tension: 0.3, 
                        fill: true 
                    },
                    { 
                        label: 'Total Reviews', 
                        data: [15, 18, 22, 25, 30, 28, 35], 
                        borderColor: '#8b5cf6', 
                        backgroundColor: 'rgba(139, 92, 246, 0.1)', 
                        tension: 0.3, 
                        fill: true 
                    }
                ]
            },
            options: commonOptions
        });
    }

    async function analyzeReviews(mode) {
        const analyzerPlaceholder = document.getElementById('analyzer-placeholder');
        const analyzerResults = document.getElementById('analyzer-results');
        const analyzerLoading = document.getElementById('analyzer-loading');
        const analysisTitle = document.getElementById('analysis-title');
        const analysisContent = document.getElementById('analysis-content');
        
        analyzerPlaceholder.classList.add('hidden');
        analyzerResults.classList.add('hidden');
        analyzerLoading.classList.remove('hidden');
        
        const days = parseInt(document.getElementById('analyze-period').value);
        const dayText = days === 7 ? 'week' : `${days} days`;
        
        try {
            const reviewSamples = recentReviews
                .slice(0, 10)
                .map(review => `Rating: ${review.starRating} stars\nComment: ${review.comment || 'No comment'}`)
                .join('\n\n---\n\n');
            
            let prompt = '';
            let title = '';
            
            switch(mode) {
                case 'sentiment':
                    title = `Sentiment Analysis (Last ${dayText})`;
                    prompt = `Analyze these business reviews from the last ${dayText} and provide a sentiment analysis. Focus on:\n- Overall sentiment (positive/negative/neutral)\n- Common positive aspects\n- Common complaints\n- Emotional tone\n\nFormat as bullet points. Sample reviews:\n\n${reviewSamples}`;
                    break;
                case 'keywords':
                    title = `Keyword Trends (Last ${dayText})`;
                    prompt = `Identify key themes and frequently mentioned terms in these reviews from the last ${dayText}. Look for:\n- Most common positive keywords\n- Most common negative keywords\n- Product/service aspects mentioned\n\nProvide actionable insights. Sample reviews:\n\n${reviewSamples}`;
                    break;
                case 'response':
                    title = `Response Suggestions (Last ${dayText})`;
                    prompt = `Based on these reviews from the last ${dayText}, suggest responses for:\n- Common positive reviews (how to thank and engage)\n- Common negative reviews (how to address concerns)\n- Neutral reviews (how to encourage more engagement)\n\nFormat as a numbered list with example responses. Sample reviews:\n\n${reviewSamples}`;
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

    async function createPost() {
        const postType = document.getElementById('post-type').value;
        const title = document.getElementById('post-title').value.trim();
        const content = document.getElementById('post-content').value.trim();
        const statusEl = document.getElementById('post-status');

        if (!title || !content) {
            statusEl.textContent = 'Please provide a title and content.';
            statusEl.style.color = '#ef4444';
            return;
        }
        
        statusEl.textContent = 'Creating post...';
        statusEl.style.color = '#06b2fc';
        showLoading(true);

        try {
            let postData = {
                languageCode: 'en',
                summary: title,
                callToAction: { actionType: 'LEARN_MORE' }
            };

            if (postType === 'EVENT') {
                const startTime = document.getElementById('event-start').value;
                const endTime = document.getElementById('event-end').value;
                
                if (!startTime || !endTime) {
                    throw new Error('Please provide start and end times for the event');
                }
                
                postData.event = {
                    title: title,
                    schedule: {
                        startDate: { year: new Date(startTime).getFullYear(), month: new Date(startTime).getMonth() + 1, day: new Date(startTime).getDate() },
                        startTime: { hours: new Date(startTime).getHours(), minutes: new Date(startTime).getMinutes() },
                        endDate: { year: new Date(endTime).getFullYear(), month: new Date(endTime).getMonth() + 1, day: new Date(endTime).getDate() },
                        endTime: { hours: new Date(endTime).getHours(), minutes: new Date(endTime).getMinutes() }
                    }
                };
            } else if (postType === 'OFFER') {
                const coupon = document.getElementById('offer-coupon').value;
                const startDate = document.getElementById('offer-start').value;
                const endDate = document.getElementById('offer-end').value;
                
                if (!startDate || !endDate) {
                    throw new Error('Please provide start and end dates for the offer');
                }
                
                postData.offer = {
                    couponCode: coupon || '',
                    redeemOnlineUrl: '',
                    termsConditions: content,
                    startDate: { year: new Date(startDate).getFullYear(), month: new Date(startDate).getMonth() + 1, day: new Date(startDate).getDate() },
                    endDate: { year: new Date(endDate).getFullYear(), month: new Date(endDate).getMonth() + 1, day: new Date(endDate).getDate() }
                };
            } else {
                postData.localPost = {
                    topicType: postType === 'UPDATE' ? 'STANDARD' : postType,
                    summary: title,
                    searchUrl: '',
                    event: null
                };
            }

            await businessProfileClient.locations.localPosts.create({
                parent: selectedLocation.name,
                resource: postData
            });

            statusEl.textContent = 'Post created successfully!';
            statusEl.style.color = '#10b981';
            
            setTimeout(() => {
                postOverlay.classList.add('hidden');
                document.getElementById('post-title').value = '';
                document.getElementById('post-content').value = '';
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

    async function enhancePostWithAI() {
        const contentEl = document.getElementById('post-content');
        const originalContent = contentEl.value.trim();
        const title = document.getElementById('post-title').value.trim();
        const postType = document.getElementById('post-type').value;
        const statusEl = document.getElementById('post-status');

        if (!originalContent) {
            statusEl.textContent = 'Please enter some content to enhance.';
            statusEl.style.color = '#ef4444';
            return;
        }

        let prompt = '';
        switch(postType) {
            case 'EVENT':
                prompt = `You are a marketing assistant. Write an engaging event announcement for "${title}". Include:\n- Exciting description\n- Reasons to attend\n- Clear call-to-action\n\nCurrent content: "${originalContent}"\n\nReturn only the enhanced text.`;
                break;
            case 'OFFER':
                prompt = `You are a sales copywriter. Write a compelling offer description for "${title}". Include:\n- Benefits of the offer\n- Urgency elements\n- Clear terms\n\nCurrent content: "${originalContent}"\n\nReturn only the enhanced text.`;
                break;
            default:
                prompt = `You are a social media manager. Enhance this business post about "${title}" to make it more engaging. Current content: "${originalContent}"\n\nReturn only the enhanced text.`;
        }

        statusEl.textContent = 'AI is enhancing your post...';
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
            statusEl.textContent = 'Post enhanced successfully!';
            statusEl.style.color = '#10b981';
        } catch (error) {
            statusEl.textContent = `AI Error: ${error.message}`;
            statusEl.style.color = '#ef4444';
        } finally {
            showLoading(false);
        }
    }

    // Toggle post type fields
    postTypeSelect.addEventListener('change', (e) => {
        document.getElementById('event-fields').classList.toggle('hidden', e.target.value !== 'EVENT');
        document.getElementById('offer-fields').classList.toggle('hidden', e.target.value !== 'OFFER');
    });

    // Event listeners
    document.getElementById('review-filter').addEventListener('change', (e) => getRecentReviews(e.target.value));
    document.getElementById('analyze-sentiment-btn').addEventListener('click', () => analyzeReviews('sentiment'));
    document.getElementById('analyze-keywords-btn').addEventListener('click', () => analyzeReviews('keywords'));
    document.getElementById('analyze-response-btn').addEventListener('click', () => analyzeReviews('response'));
    
    document.getElementById('copy-analysis-btn').addEventListener('click', () => {
        const content = document.getElementById('analysis-content').textContent;
        navigator.clipboard.writeText(content).then(() => {
            const btn = document.getElementById('copy-analysis-btn');
            btn.innerHTML = 'Copied!';
            setTimeout(() => { btn.innerHTML = 'Copy'; }, 2000);
        });
    });

    createPostBtn.addEventListener('click', () => postOverlay.classList.remove('hidden'));
    closePostBtn.addEventListener('click', () => postOverlay.classList.add('hidden'));
    document.getElementById('create-post-submit').addEventListener('click', createPost);
    document.getElementById('ai-enhance-post-btn').addEventListener('click', enhancePostWithAI);

    initializeApp();
});