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
const resultsSection = document.getElementById('resultsSection');
const errorSection = document.getElementById('errorSection');
const saveBtn = document.getElementById('saveBtn');
const generateAnotherBtn = document.getElementById('generateAnotherBtn');
const retryBtn = document.getElementById('retryBtn');

// Event Listeners
verbForm.addEventListener('submit', handleVerbSubmission);
saveBtn.addEventListener('click', saveCards);
generateAnotherBtn.addEventListener('click', resetForm);
retryBtn.addEventListener('click', () => {
    if (currentVerbData?.verb) {
        generateVerb(currentVerbData.verb);
    }
});

// Handle form submission
async function handleVerbSubmission(e) {
    e.preventDefault();
    const verb = verbInput.value.trim().toLowerCase();
    
    if (!verb) {
        showError('Please enter a verb');
        return;
    }
    
    await generateVerb(verb);
}

// Generate verb conjugations
async function generateVerb(verb) {
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/api/generate-verb`, {
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
        
        currentVerbData = data;
        displayResults(data);
        
    } catch (error) {
        console.error('Generation error:', error);
        showError(error.message || 'Failed to generate verb conjugations');
    }
}

// Display the generated results
function displayResults(data) {
    hideAllSections();
    
    // Update verb context
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
        cardCount.textContent = `${data.conjugations.length} cards generated`;
    } else {
        previewGrid.innerHTML = '<p class="no-cards">No conjugations generated</p>';
        cardCount.textContent = '0 cards generated';
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
    if (!currentVerbData || !currentVerbData.conjugations) {
        showError('No cards to save');
        return;
    }
    
    saveBtn.disabled = true;
    saveBtn.innerHTML = '💾 Saving...';
    
    try {
        const response = await fetch(`${API_BASE}/api/cards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                verb_cards: currentVerbData.conjugations.map(conjugation => ({
                    verb: currentVerbData.verb,
                    pronoun: conjugation.pronoun,
                    tense: conjugation.tense,
                    mood: conjugation.mood,
                    conjugated_form: conjugation.form
                }))
            })
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
function showLoading() {
    hideAllSections();
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
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
    generateBtn.disabled = false;
}

// Focus on input when page loads
document.addEventListener('DOMContentLoaded', () => {
    verbInput.focus();
});
