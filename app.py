# app.py (Main Application Logic)
from flask import Flask, render_template, request, session, redirect, url_for
import secrets
import socket
import qrcode
from io import BytesIO
import base64
import threading
import webbrowser
import random

# Import configuration and data
from utils import generate_qr_code, get_local_ip
from utils import display_name_to_filename, filename_to_display_name, get_mountain_names

from config import TREASURE_HUNT, CLUE_CODE_MESSAGE, CLUE_CODE_ANSWER
from config import SCROLL_CHALLENGE         # scroll challenge
from config import HIGHER_LOWER_GAME        # higher lower challenge
from config import ROTATION_CHALLENGE       # rotation challenge
from config import MOUNTAIN_QUIZ            # mountain challenge
from config import FINAL_PAGE               # final page

app = Flask(__name__)
app.secret_key = secrets.token_hex(16) 

# --- GENERAL ROUTES ---

@app.route('/')
def index():
    """Redirects base path to the setup page."""
    return redirect(url_for('landing_page'))

@app.route('/setup')
def landing_page():
    """Landing page to select Clue Phone or Searcher Phone role"""
    local_ip = get_local_ip()
    hunt_url = f"http://{local_ip}:5000/higher-lower"
    qr_image = generate_qr_code(hunt_url, size=8)

    # Renders from templates/landing_page.html
    return render_template(
        'landing_page.html',
        qr_image=qr_image
    )

@app.route('/hint', methods=['POST'])
def show_hint():
    session['show_hint'] = True
    return redirect(url_for('hunt'))

@app.route('/reset', methods=['POST'])
def reset():
    session.clear()
    return redirect(url_for('hunt'))

# --- HUNT ROUTE START ---

@app.route('/hunt', methods=['GET', 'POST'])
def hunt():
    """Main game logic route for the Searcher's Phone"""
    # Initialize session state
    if 'current_clue' not in session:
        session['current_clue'] = 0
        session['show_hint'] = False
        session['physical_clue_found'] = False 
    
    current_clue = session['current_clue']
    total_clues_digital = len(TREASURE_HUNT['clues'])
    
    # --- State 3: Treasure Found ---
    if session.get('physical_clue_found') and current_clue >= total_clues_digital:
        # Renders from templates/treasure_found.html
        return render_template(
            'treasure_found.html',
            treasure_message=TREASURE_HUNT['treasure_message'],
            total_clues=total_clues_digital + 1
        )

    # --- State 2: Physical Clue Submission (Final Check) ---
    if current_clue >= total_clues_digital and not session.get('physical_clue_found'):
        error = None
        if request.method == 'POST':
            answer = request.form.get('answer', '').strip()
            correct_answer = CLUE_CODE_MESSAGE # Requires exact match of the message
            
            if answer == correct_answer:
                session['physical_clue_found'] = True
                return redirect(url_for('hunt'))
            else:
                error = f'❌ De ingevoerde boodschap klopt niet. Je moet exact "{CLUE_CODE_MESSAGE}" invoeren.'
        
        # Renders from templates/physical_clue.html
        return render_template(
            'physical_clue.html',
            current_clue=current_clue,
            total_clues=total_clues_digital + 1,
            error=error
        )

    # --- State 1: Digital Clues ---
    clue = TREASURE_HUNT['clues'][current_clue]
    error = None
    hint = clue['hint'] if session.get('show_hint') else None
    
    if request.method == 'POST':
        answer = request.form.get('answer', '').strip().lower()
        correct_answer = clue['answer'].lower()
        
        if answer == correct_answer:
            session['current_clue'] = current_clue + 1
            session['show_hint'] = False
            return redirect(url_for('hunt'))
        else:
            error = '❌ Dat is niet helemaal correct. Probeer het opnieuw!'
    
    # Renders from templates/hunt_page.html
    return render_template(
        'hunt_page.html',
        clue=clue,
        current_clue=current_clue,
        total_clues=total_clues_digital,
        error=error,
        hint=hint
    )

# --- SCROLL CHALLENGE ROUTES ---

@app.route('/scroll')
def scroll_challenge():
    """First challenge - scroll puzzle"""
    return render_template('scroll_challenge.html', config=SCROLL_CHALLENGE)

@app.route('/scroll/wrong')
def scroll_challenge_wrong():
    """Redirect back to start when wrong button is pressed"""
    return redirect(url_for('reset_higher_lower'))

@app.route('/scroll/success')
def scroll_challenge_success():
    """Success page for scroll challenge"""
    return redirect(url_for('rotation_challenge'))

# --- HIGHER / LOWER CHALLENGE ROUTES ---

@app.route('/higher-lower', methods=['GET', 'POST'])
def higher_lower_game():
    """Higher or Lower game - single page version"""
    # Initialize or reset game
    if 'hl_score' not in session or request.args.get('reset'):
        topics = HIGHER_LOWER_GAME['topics'].copy()
        random.shuffle(topics)
        session['hl_topics'] = topics
        session['hl_current_index'] = 0
        session['hl_score'] = 0
        session['hl_show_result'] = False
        session['hl_last_correct'] = None
    
    # Handle guess
    if request.method == 'POST':
        guess = request.form.get('guess')
        topics = session['hl_topics']
        current_index = session['hl_current_index']
        
        if current_index < len(topics) - 1:
            current_topic = topics[current_index]
            next_topic = topics[current_index + 1]
            
            # Check if guess is correct
            correct = False
            if guess == 'higher' and next_topic['params'] > current_topic['params']:
                correct = True
            elif guess == 'lower' and next_topic['params'] < current_topic['params']:
                correct = True
            elif next_topic['params'] == current_topic['params']:
                correct = True  # Equal counts are always correct
            
            session['hl_last_correct'] = correct
            session['hl_show_result'] = True
            
            if correct:
                session['hl_score'] = session['hl_score'] + 1
                # Don't advance index yet - do it when they click "Volgende"
                
                # Check if won
                if session['hl_score'] >= HIGHER_LOWER_GAME['win_count']:
                    return redirect(url_for(HIGHER_LOWER_GAME['next_route']))
            else:
                # Game over - reset
                session['hl_score'] = 0
    
    topics = session.get('hl_topics', [])
    current_index = session.get('hl_current_index', 0)
    score = session.get('hl_score', 0)
    show_result = session.get('hl_show_result', False)
    last_correct = session.get('hl_last_correct', None)
    
    if current_index >= len(topics) - 1:
        # Ran out of topics, reshuffle
        topics = HIGHER_LOWER_GAME['topics'].copy()
        random.shuffle(topics)
        session['hl_topics'] = topics
        session['hl_current_index'] = 0
        current_index = 0
    
    current_topic = topics[current_index]
    next_topic = topics[current_index + 1] if current_index + 1 < len(topics) else topics[0]
    
    return render_template('higher_lower.html',
                         config=HIGHER_LOWER_GAME,
                         current_topic=current_topic,
                         next_topic=next_topic,
                         score=score,
                         show_result=show_result,
                         last_correct=last_correct)

@app.route('/higher-lower/continue', methods=['POST'])
def higher_lower_continue():
    """Continue to next round after seeing result"""
    # NOW we advance the index
    session['hl_current_index'] = session.get('hl_current_index', 0) + 1
    session['hl_show_result'] = False
    session['hl_last_correct'] = None
    return redirect(url_for('higher_lower_game'))

@app.route('/higher-lower/reset')
def reset_higher_lower():
    """
    Resets the Higher/Lower score and sends the user back to the 
    start of the Higher/Lower game.
    """
    # 1. Reset the score variable in the session
    session['hl_score'] = 0 
    session['hl_show_result'] = False
    session['hl_last_correct'] = None
    
    # 2. Redirect the player to the start of the Higher/Lower game
    # Assuming 'higher_lower_game' is the endpoint function that starts the game.
    return redirect(url_for('higher_lower_game'))

# --- ROTATION CHALLENGE ROUTES ---

@app.route('/rotation', methods=['GET', 'POST'])
def rotation_challenge():
    """Screen rotation challenge - solution appears in landscape mode"""
    decoy_message = None
    
    if request.method == 'POST':
        # Any answer triggers a decoy response
        answer = request.form.get('answer', '').strip()
        if answer:
            decoy_message = random.choice(ROTATION_CHALLENGE['decoy_responses'])
    
    return render_template('rotation_challenge.html', 
                         config=ROTATION_CHALLENGE,
                         decoy_message=decoy_message)

# --- MOUNTAIN CHALLENGE ROUTES ---

@app.route('/mountains', methods=['GET', 'POST'])
def mountain_challenge():
    """Mountain quiz - identify mountains by picture or name"""
    
    # Handle answer FIRST, before checking for reset
    if request.method == 'POST' and not session.get('mq_show_result'):
        selected = request.form.get('answer')
        correct_answer = session.get('mq_correct_answer')
        
        print(f"DEBUG: Selected={selected}, Correct={correct_answer}, Match={selected == correct_answer}")  # Debug line
        
        correct = (selected == correct_answer)
        session['mq_last_correct'] = correct
        session['mq_show_result'] = True
        
        if correct:
            session['mq_score'] = session.get('mq_score', 0) + 1
            if session['mq_score'] >= MOUNTAIN_QUIZ['win_count']:
                # Won the game!
                session.pop('mq_score', None)
                session.pop('mq_show_result', None)
                session.pop('mq_last_correct', None)
                return redirect(url_for(MOUNTAIN_QUIZ['next_route']))
        else:
            # Reset score but DON'T generate new question yet
            session['mq_score'] = 0
        
        # Return immediately after processing answer, don't check for reset
        config = MOUNTAIN_QUIZ
        score = session.get('mq_score', 0)
        show_result = session.get('mq_show_result', False)
        last_correct = session.get('mq_last_correct', None)
        question_type = session.get('mq_question_type')
        question_data = session.get('mq_question_data')
        options = session.get('mq_options')
        correct_answer = session.get('mq_correct_answer')
        
        print(f"DEBUG RENDER AFTER POST: type={question_type}, data={question_data}, correct={correct_answer}")
        
        return render_template('mountain_challenge.html',
                             config=config,
                             score=score,
                             show_result=show_result,
                             last_correct=last_correct,
                             question_type=question_type,
                             question_data=question_data,
                             options=options,
                             correct_answer=correct_answer)
    
    # Initialize or reset game (only for GET requests or when no score exists)
    if 'mq_score' not in session or request.args.get('reset'):
        session['mq_score'] = 0
        session['mq_show_result'] = False
        session['mq_last_correct'] = None
        generate_mountain_question()
    
    config = MOUNTAIN_QUIZ
    score = session.get('mq_score', 0)
    show_result = session.get('mq_show_result', False)
    last_correct = session.get('mq_last_correct', None)
    question_type = session.get('mq_question_type')
    question_data = session.get('mq_question_data')
    options = session.get('mq_options')
    correct_answer = session.get('mq_correct_answer')
    
    print(f"DEBUG RENDER: type={question_type}, data={question_data}, correct={correct_answer}")
    
    return render_template('mountain_challenge.html',
                         config=config,
                         score=score,
                         show_result=show_result,
                         last_correct=last_correct,
                         question_type=question_type,
                         question_data=question_data,
                         options=options,
                         correct_answer=correct_answer)

@app.route('/mountains/continue', methods=['POST'])
def mountain_quiz_continue():
    """Continue to next question"""
    session['mq_show_result'] = False
    session['mq_last_correct'] = None
    generate_mountain_question()
    return redirect(url_for('mountain_challenge'))

def generate_mountain_question():
    """Generate a new random question (type 1 or 2)"""
    mountains = MOUNTAIN_QUIZ['mountains']  # These are display names
    question_type = random.choice(['image_to_name', 'name_to_image'])
    
    # Pick correct answer (display name)
    correct_mountain = random.choice(mountains)
    
    # Pick 3 wrong answers (display names)
    wrong_mountains = [m for m in mountains if m != correct_mountain]
    wrong_answers = random.sample(wrong_mountains, 3)
    
    # Combine and shuffle
    all_options = [correct_mountain] + wrong_answers
    random.shuffle(all_options)
    
    if question_type == 'image_to_name':
        # Show image, pick name
        session['mq_question_type'] = 'image_to_name'
        session['mq_question_data'] = display_name_to_filename(correct_mountain)  # Store filename for image
        session['mq_options'] = all_options  # Display names
        session['mq_correct_answer'] = correct_mountain  # User selects display name
    else:
        # Show name, pick image
        session['mq_question_type'] = 'name_to_image'
        session['mq_question_data'] = correct_mountain  # Display name to show
        session['mq_options'] = [display_name_to_filename(m) for m in all_options]  # Filenames for images
        session['mq_correct_answer'] = display_name_to_filename(correct_mountain)

# --- FINAL PAGE ---

@app.route('/final')
def final_page():
    """Final celebration page"""
    return render_template('final_page.html', config=FINAL_PAGE)


@app.route('/clue-phone')
def show_clue_phone():
    """Dedicated page for the Clue Phone (physical target)"""
    local_ip = get_local_ip()
    hunt_url = f"http://{local_ip}:5000/hunt"
    qr_image = generate_qr_code(hunt_url, size=8)

    # Renders from templates/clue_phone.html
    return render_template(
        'clue_phone.html',
        clue_code_message=CLUE_CODE_MESSAGE,
        qr_image=qr_image
    )

if __name__ == '__main__':
    local_ip = get_local_ip()
    url = f"http://{local_ip}:5000"
    
    print("\n" + "="*50)
    print("🗺️  TREASURE HUNT SERVER GESTART")
    print("="*50)
    print("\nServer draait op: " + url)
    print("\n1. OPEN OP EEN COMPUTER/SETUP-APPARAAT:")
    print(f"   Ga naar: {url}/qr")
    print("="*50 + "\n")
    
    import webbrowser
    def open_browser():
        import time
        time.sleep(1.5) 
        webbrowser.open(f'{url}/setup')
    
    threading.Thread(target=open_browser, daemon=True).start()
    
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)