from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import json
import os
import requests

app = Flask(__name__)

# Database setup
DATABASE = 'flashcards.db'

def init_db():
    """Initialize the database with our tables"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Verb cards table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS verb_cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            verb TEXT NOT NULL,
            pronoun TEXT NOT NULL,
            tense TEXT NOT NULL,
            mood TEXT NOT NULL,
            conjugated_form TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Sentence cards table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sentence_cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            spanish_sentence TEXT NOT NULL,
            english_translation TEXT NOT NULL,
            grammar_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

def get_db_connection():
    """Get a database connection"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row  # This enables column access by name
    return conn

# Initialize database when server starts
init_db()

# Serve static files
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

# API Routes
@app.route('/api/health')
def health_check():
    return jsonify({"status": "healthy", "message": "Spanish Flashcards API is running!"})

@app.route('/api/cards', methods=['GET'])
def get_cards():
    """Get all cards for studying"""
    conn = get_db_connection()
    
    # Get verb cards
    verb_cards = conn.execute('''
        SELECT id, verb, pronoun, tense, mood, conjugated_form, 'verb' as card_type
        FROM verb_cards
        ORDER BY created_at DESC
    ''').fetchall()
    
    # Get sentence cards  
    sentence_cards = conn.execute('''
        SELECT id, spanish_sentence, english_translation, grammar_notes, 'sentence' as card_type
        FROM sentence_cards
        ORDER BY created_at DESC
    ''').fetchall()
    
    conn.close()
    
    # Convert to dictionaries
    cards = []
    for card in verb_cards:
        cards.append(dict(card))
    for card in sentence_cards:
        cards.append(dict(card))
    
    return jsonify({"cards": cards, "count": len(cards)})

@app.route('/api/cards', methods=['POST'])
def save_cards():
    """Save new cards to database"""
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    conn = get_db_connection()
    saved_count = 0
    
    try:
        # Handle verb cards
        if 'verb_cards' in data:
            for card in data['verb_cards']:
                conn.execute('''
                    INSERT INTO verb_cards (verb, pronoun, tense, mood, conjugated_form)
                    VALUES (?, ?, ?, ?, ?)
                ''', (card['verb'], card['pronoun'], card['tense'], card['mood'], card['conjugated_form']))
                saved_count += 1
        
        # Handle sentence cards
        if 'sentence_cards' in data:
            for card in data['sentence_cards']:
                conn.execute('''
                    INSERT INTO sentence_cards (spanish_sentence, english_translation, grammar_notes)
                    VALUES (?, ?, ?)
                ''', (card['spanish_sentence'], card['english_translation'], card.get('grammar_notes', '')))
                saved_count += 1
        
        conn.commit()
        conn.close()
        
        return jsonify({"message": f"Saved {saved_count} cards successfully"})
        
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500

@app.route('/api/cards/<int:card_id>', methods=['DELETE'])
def delete_card(card_id):
    """Delete a specific card"""
    card_type = request.args.get('type', 'verb')  # Default to verb
    
    conn = get_db_connection()
    
    if card_type == 'verb':
        conn.execute('DELETE FROM verb_cards WHERE id = ?', (card_id,))
    else:
        conn.execute('DELETE FROM sentence_cards WHERE id = ?', (card_id,))
    
    conn.commit()
    conn.close()
    
    return jsonify({"message": "Card deleted successfully"})

@app.route('/api/generate-verb', methods=['POST'])
def generate_verb():
    """Generate verb conjugations using local Ollama"""
    data = request.get_json()
    verb = data.get('verb')
    
    if not verb:
        return jsonify({"error": "No verb provided"}), 400
    
    try:
        # Call local Ollama
        ollama_response = requests.post('http://localhost:11434/api/generate', json={
            "model": "gemma3n:latest",
            "prompt": f"Generate COMPLETE Spanish verb conjugations for '{verb}' following this exact structure. Return JSON format:\n{{\n  \"verb\": \"{verb}\",\n  \"overview\": \"Brief description of when/how this verb is used\",\n  \"related_verbs\": [\"similar_verb1\", \"similar_verb2\"],\n  \"notes\": \"Special usage patterns, irregularities, or cultural context\",\n  \"conjugations\": [\n    {{\"pronoun\": \"yo\", \"tense\": \"present\", \"mood\": \"indicative\", \"form\": \"hablo\"}},\n    {{\"pronoun\": \"yo\", \"tense\": \"present\", \"mood\": \"subjunctive\", \"form\": \"hable\"}}\n  ]\n}}\n\nMUST generate ALL of these tenses for ALL pronouns (yo, tú, él/ella/usted, nosotros, vosotros, ellos/ellas/ustedes):\n\n**INDICATIVE MOOD:**\n- Simple: present, preterite, imperfect, future\n- Compound: present_perfect, past_perfect, future_perfect\n\n**SUBJUNCTIVE MOOD:**\n- Simple: present, imperfect, imperfect_alt (alternative form)\n- Compound: present_perfect, past_perfect\n\n**CONDITIONAL MOOD:**\n- Simple: simple_conditional\n- Compound: conditional_perfect\n\n**IMPERATIVE MOOD:**\n- Simple: affirmative_present (for tú, usted, nosotros, vosotros, ustedes only)\n\nThis should generate approximately 70-80 conjugations total. Use exact tense names as listed above. Only return valid JSON, no other text.",
            "stream": False
        })
        
        if ollama_response.status_code != 200:
            return jsonify({"error": "Ollama request failed"}), 500
            
        result = ollama_response.json()
        generated_text = result.get('response', '')
        
        # Try to parse the JSON response
        try:
            # Clean up the response (remove any extra text)
            json_start = generated_text.find('{')
            json_end = generated_text.rfind('}') + 1
            json_text = generated_text[json_start:json_end]
            
            conjugation_data = json.loads(json_text)
            return jsonify(conjugation_data)
            
        except json.JSONDecodeError:
            return jsonify({"error": "Could not parse AI response", "raw_response": generated_text}), 500
            
    except requests.RequestException:
        return jsonify({"error": "Could not connect to Ollama. Is it running on localhost:11434?"}), 500

@app.route('/api/process-sentence', methods=['POST'])
def process_sentence():
    """Process Spanish sentences using local Ollama"""
    data = request.get_json()
    sentence = data.get('sentence')
    
    if not sentence:
        return jsonify({"error": "No sentence provided"}), 400
    
    try:
        # Call local Ollama
        ollama_response = requests.post('http://localhost:11434/api/generate', json={
            "model": "gemma3n:latest",
            "prompt": f"Fix any typos and add missing accents to this Spanish sentence, then provide an English translation with grammar notes. Return in this exact JSON format:\n{{\n  \"corrected_spanish\": \"corrected sentence\",\n  \"english_translation\": \"English translation\",\n  \"grammar_notes\": \"Brief grammar explanation\"\n}}\n\nSpanish sentence: {sentence}\n\nOnly return the JSON, no other text.",
            "stream": False
        })
        
        if ollama_response.status_code != 200:
            return jsonify({"error": "Ollama request failed"}), 500
            
        result = ollama_response.json()
        generated_text = result.get('response', '')
        
        # Try to parse the JSON response
        try:
            json_start = generated_text.find('{')
            json_end = generated_text.rfind('}') + 1
            json_text = generated_text[json_start:json_end]
            
            sentence_data = json.loads(json_text)
            return jsonify(sentence_data)
            
        except json.JSONDecodeError:
            return jsonify({"error": "Could not parse AI response", "raw_response": generated_text}), 500
            
    except requests.RequestException:
        return jsonify({"error": "Could not connect to Ollama. Is it running on localhost:11434?"}), 500

if __name__ == '__main__':
    # Use environment variable for port (Railway sets this)
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=True)
