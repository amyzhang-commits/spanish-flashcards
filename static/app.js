// API Configuration
const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000' 
    : 'https://spanish-flashcards-production.up.railway.app';

// Global state
let currentVerbData = null;

// DOM Elements
const verbForm = document.getElementById('verbForm');
const verbInput = document.getElementById('verbInput');
const generateBtn = document.getElementById('generateBtn');
const loadingSection = document.getElementById('loadingSection');
const assessmentSection = document.getElementById('assessmentSection');
const resultsSection = document.getElementById('resultsSection');
const errorSection = document.getElementById('errorSection');
const saveBtn = document.getElementById('saveBtn');
const generateAnotherBtn = document.getElementById('generateAnotherBtn');
const retryBtn = document.getElementById('retryBtn');

// Assessment section elements
const meaningOnlyBtn = document.getElementById('meaningOnlyBtn');
const coreBtn = document.getElementById('coreBtn');
const fullBtn = document.getElementById('fullBtn');

// Event Listeners
verbForm.addEventListener('submit', handleVerbSubmission);
saveBtn.addEventListener('click', saveCards);
generateAnotherBtn.addEventListener('click', resetForm);
retryBtn.addEventListener('click', () => {
    if (currentVerbData?.verb) {
        assessVerb(currentVerbData.verb);
    }
});

// Assessment option listeners
meaningOnlyBtn.addEventListener('click', () => generateVerb(currentVerbData.verb, 'meaning_only'));
coreBtn.addEventListener('click', () => generateVerb(currentVerbData.verb, 'core'));
fullBtn.addEventListener('click', () => generateVerb(currentVerbData.verb, 'full'));

// Handle form submission - now starts with assessment
async function handleVerbSubmission(e) {
    e.preventDefault();
    const verb = verbInput.value.trim().toLowerCase();
    
    if (!verb) {
        showError('Please enter a verb');
        return;
    }
    
    await assessVerb(verb);
}

// Stage 1: Assess the verb
async function assessVerb(verb) {
    showLoading('Analyzing verb complexity...');
    
    try {
        const response = await fetch(`${API_BASE}/api/assess-verb`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ verb })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        currentVerbData = { verb: data.verb };
        displayAssessment(data);
        
    } catch (error) {
        console.error('Assessment error:', error);
        showError(error.message || 'Failed to assess verb');
    }
}

// Display assessment results
function displayAssessment(data) {
    hideAllSections();
    
    document.getElementById('assessmentTitle').textContent = `Analysis: ${data.verb}`;
    
    // Complexity badge
    const complexityBadge = document.getElementById('verbComplexity');
    complexityBadge.textContent = data.complexity;
    complexityBadge.className = `complexity-badge ${data.complexity}`;
    
    // Assessment details
    document.getElementById('assessmentOverview').textContent = data.overview || 'No overview available';
    document.getElementById('assessmentNotes').textContent = data.special_notes || 'No special notes';
    
    // Recommended practice badge
    const practiceRecommendation = data.recommended_practice || 'core';
    const practiceBadge = document.getElementById('recommendedPractice');
    practiceBadge.textContent = practiceRecommendation.replace('_', ' ');
    practiceBadge.className = `practice-badge ${practiceRecommendation}`;
    
    // Highlight recommended option
    document.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('recommended'));
    if (practiceRecommendation === 'meaning_only') {
        meaningOnlyBtn.classList.add('recommended');
    } else if (practiceRecommendation === 'core') {
        coreBtn.classList.add('recommended');
    } else {
        fullBtn.classList.add('recommended');
    }
    
    assessmentSection.style.display = 'block';
}

// Stage 2: Generate verb with chosen depth
async function generateVerb(verb, depth) {
    const depthLabels = {
        'meaning_only': 'meaning card',
        'core': 'core conjugations',
        'full': 'complete conjugations'
    };
    
    showLoading(`Generating ${depthLabels[depth]}...`);
    
    try {
        const response = await fetch(`${API_BASE}/api/generate-verb-targeted`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ verb, depth })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        currentVerbData = { ...data, generationType: depth };
        displayResults(data, depth);
        
    } catch (error) {
        console.error('Generation error:', error);
        showError(error.message || 'Failed to generate verb content');
    }
}

// Display the generated results
function displayResults(data, generationType) {
    hideAllSections();
    
    if (generationType === 'meaning_only') {
        // Handle meaning-only cards differently
        document.getElementById('verbTitle').textContent = `Verb: ${data.verb}`;
        document.getElementById('verbOverview').textContent = data.english_meaning || 'Translation provided';
        document.getElementById('relatedVerbs').innerHTML = '<span class="no-data">N/A for meaning cards</span>';
        document.getElementById('verbNotes').textContent = data.example_sentence || 'No example provided';
        
        // Create a simple meaning card preview
        const previewGrid = document.getElementById('previewGrid');
        const cardCount = document.getElementById('cardCount');
        
        previewGrid.innerHTML = `
            <div class="card-preview meaning-card">
                <div class="card-front">
                    <span class="verb-spanish">${data.verb}</span>
                </div>
                <div class="card-back">
                    <span class="verb-english">${data.english_meaning}</span>
                    ${data.example_sentence ? `<div class="example"><small>${data.example_sentence}</small></div>` : ''}
                </div>
            </div>
        `;
        cardCount.textContent = '1 meaning card generated';
        
    } else {
        // Handle conjugation cards (core or full)
        document.getElementById('verbTitle').textContent = `Verb: ${data.verb}`;
        document.getElementById('verbOverview').textContent = data.overview || 'No overview available';
        document.getElementById('verbNotes').textContent = data.notes || 'No special notes';
        
        // Display related verbs
        const relatedVerbsContainer = document.getElementById('relatedVerbs');
        if (data.related_verbs && data.related_verbs.length > 0) {
            relatedVerbsContainer.innerHTML = data.related_verbs
                .map(verb => `<span class="related-verb">${verb}</span>`)
                .join(' ');
        } else {
            relatedVerbsContainer.innerHTML = '<span class="no-data">None provided</span>';
        }
        
        // Display conjugation cards
        const previewGrid = document.getElementById('previewGrid');
        const cardCount = document.getElementById('cardCount');
        
        if (data.conjugations && data.conjugations.length > 0) {
            previewGrid.innerHTML = data.conjugations
                .map(conjugation => createCardPreview(conjugation))
                .join('');
            const typeLabel = generationType === 'core' ? 'core' : 'complete';
            cardCount.textContent = `${data.conjugations.length} ${typeLabel} cards generated`;
        } else {
            previewGrid.innerHTML = '<p class="no-cards">No conjugations generated</p>';
            cardCount.textContent = '0 cards generated';
        }
    }
    
    resultsSection.style.display = 'block';
}

// Create a card preview
function createCardPreview(conjugation) {
    return `
        <div class="card-preview">
            <div class="card-front">
                <div class="card-prompt">
                    <span class="pronoun">${conjugation.pronoun}</span>
                    <span class="verb">${currentVerbData.verb}</span>
                    <span class="tense-mood">${conjugation.tense} ${conjugation.mood}</span>
                </div>
            </div>
            <div class="card-back">
                <span class="conjugated-form">${conjugation.form}</span>
            </div>
        </div>
    `;
}

// Save cards to database
async function saveCards() {
    if (!currentVerbData || (!currentVerbData.conjugations && !currentVerbData.english_meaning)) {
        showError('No cards to save');
        return;
    }
    
    saveBtn.disabled = true;
    saveBtn.innerHTML = '💾 Saving...';
    
    try {
        let requestBody;
        
        if (currentVerbData.generationType === 'meaning_only') {
            // Save as sentence card for meaning-only
            requestBody = {
                sentence_cards: [{
                    spanish_sentence: currentVerbData.verb,
                    english_translation: currentVerbData.english_meaning,
                    grammar_notes: `Meaning card: ${currentVerbData.example_sentence || ''}`
                }]
            };
        } else {
            // Save as verb cards for conjugations
            requestBody = {
                verb_cards: currentVerbData.conjugations.map(conjugation => ({
                    verb: currentVerbData.verb,
                    pronoun: conjugation.pronoun,
                    tense: conjugation.tense,
                    mood: conjugation.mood,
                    conjugated_form: conjugation.form
                }))
            };
        }
        
        const response = await fetch(`${API_BASE}/api/cards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to save cards: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Show success
        saveBtn.innerHTML = '✅ Cards Saved!';
        saveBtn.classList.add('success');
        
        // Reset button after 2 seconds
        setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '💾 Save All Cards';
            saveBtn.classList.remove('success');
        }, 2000);
        
    } catch (error) {
        console.error('Save error:', error);
        showError(error.message || 'Failed to save cards');
        
        saveBtn.disabled = false;
        saveBtn.innerHTML = '💾 Save All Cards';
    }
}

// Reset form for another verb
function resetForm() {
    hideAllSections();
    verbInput.value = '';
    verbInput.focus();
    currentVerbData = null;
}

// Show loading state
function showLoading(message = 'Processing...') {
    hideAllSections();
    loadingSection.querySelector('p').textContent = message;
    loadingSection.style.display = 'block';
    generateBtn.disabled = true;
}

// Show error
function showError(message) {
    hideAllSections();
    document.getElementById('errorText').textContent = message;
    errorSection.style.display = 'block';
    generateBtn.disabled = false;
}

// Hide all sections
function hideAllSections() {
    loadingSection.style.display = 'none';
    assessmentSection.style.display = 'none';
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
    generateBtn.disabled = false;
}

// Focus on input when page loads
document.addEventListener('DOMContentLoaded', () => {
    verbInput.focus();
});
