# config.py (Game Data)

# --- Scroll challenge ---

SCROLL_CHALLENGE = {
    'id': 'scroll_puzzle',
    'title': 'Uitdaging 1',
    'instruction': 'Wat moet je doen?',
    'wrong_button_text': 'NIET DRUKKEN',
    'correct_button_text': 'Drukken',
    'success_message': 'Goed gedaan! Je hebt de eerste uitdaging voltooid!',
    'spacer_height': '150vh'  # Height to force scrolling
}

# --- Higher lower challenge ---

HIGHER_LOWER_GAME = {
    'title': 'Hoger of Lager?',
    'instruction': 'Welk AI model heeft meer parameters?',
    'topics': [

        # --- OpenAI ---
        {'name': "GPT-3", 'params': 175_000_000_000},
        {'name': "GPT-2 XL", 'params': 1_500_000_000},

        # --- Google ---
        {'name': "PaLM (flagship)", 'params': 540_000_000_000},
        {'name': "PaLM 2 (flagship, Unicorn)", 'params': 340_000_000_000},  # openbaar geschatte hoogste variant
        {'name': "T5 (flagship)", 'params': 11_000_000_000},

        # --- Meta ---
        {'name': "LLaMA (flagship)", 'params': 65_000_000_000},
        {'name': "LLaMA 2 (flagship)", 'params': 70_000_000_000},

        # --- Anthropic ---
        {'name': "Claude 1 (flagship)", 'params': 52_000_000_000},  # dit is het enige openbaar gekomen getal
        # (Claude 2/3 hebben geen officiële parameter disclosures → dus niet opnemen)

        # --- Mistral ---
        {'name': "Mixtral 8x7B (flagship open-weight)", 'params': 46_700_000_000},  # 8 experts * 7B (sparse)

        # --- EleutherAI ---
        {'name': "GPT-NeoX (flagship)", 'params': 20_000_000_000},
        {'name': "GPT-J (flagship)", 'params': 6_000_000_000},

        # --- Falcon ---
        {'name': "Falcon (flagship)", 'params': 180_000_000_000},

        # --- DeepSeek ---
        {'name': "DeepSeek-V2 (flagship)", 'params': 236_000_000_000},  # sparse MoE exposure count

        # --- BigScience ---
        {'name': "BLOOM (flagship)", 'params': 176_000_000_000},

        # --- Nvidia ---
        {'name': "Megatron-Turing NLG", 'params': 530_000_000_000},  # Microsoft's largest public variant

        # --- Huawei ---
        {'name': "PanGu-α (flagship)", 'params': 200_000_000_000},

        # --- Baidu ---
        {'name': "ERNIE 3.0 Titan", 'params': 260_000_000_000},

        # --- SenseTime ---
        {'name': "SenseNova (flagship)", 'params': 100_000_000_000},  # publiek gemelde bovenste variant

        # --- Stability AI / Imagenomics (diffusion) ---
        {'name': "Stable Diffusion 1.x U-Net", 'params': 860_000_000},
        {'name': "Stable Diffusion XL (full)", 'params': 2_600_000_000},

        # --- OpenCLIP / contrastive models ---
        {'name': "OpenCLIP H/14 (largest)", 'params': 1_000_000_000},

        # --- Vision Transformers ---
        {'name': "ViT-H/14", 'params': 632_000_000},
        {'name': "ViT-g/14", 'params': 1_800_000_000},

        # --- DeepMind ---
        {'name': "Gato", 'params': 1_200_000_000},
        {'name': "Chinchilla", 'params': 70_000_000_000},  # exact disclosed
        {'name': "Gopher (flagship)", 'params': 280_000_000_000},

        # --- IBM / Watson NLP ---
        {'name': "Project Debater language model", 'params': 150_000_000},  # disclosed research variant

        # --- JOUW MODEL ---
        {'name': "Arthur's graduation project Unet", 'params': 20_000_000}
    ],
    'win_count': 10,  # Number of correct answers needed to win
    'success_message': 'Gefeliciteerd! Je hebt het spel gewonnen!',
    'next_route': 'scroll_challenge'  # Where to go after winning
}

# --- Rotate challenge ---

ROTATION_CHALLENGE = {
    'title': 'Cryptische Aanwijzing',
    'riddle': 'Als alles op zijn kant beter past, wijs dan de wereld een andere kant op.',
    'decoy_responses': [
        'Jij hebt nog niet je draai gevonden...',
        'Misschien moet je een andere richting zoeken?',
        'Bijna! Maar er mist nog iets...',
        'Draai het eens anders aan...',
        'Je bent nog niet helemaal om...',
        'Als alles op zijn kant beter past, verander dan je perspectief.',
        'Als je zicht te smal lijkt, draai dan eens aan je horizon.'
    ],
    'landscape_message': 'Perfect! Je hebt het geheim ontdekt!',
    'button_text': 'Volgende uitdaging',
    'next_route': 'mountain_challenge'
}

# --- Mountain challenge ---
from utils import get_mountain_names
MOUNTAIN_QUIZ = {
    'title': 'Berg Quiz',
    'instruction_image': 'Welke berg zie je hier?',
    'instruction_name': 'Welk plaatje hoort bij deze berg?',
    'mountains': get_mountain_names(),
    'win_count': 10,
    'success_message': 'Geweldig! Je kent je bergen!',
    'next_route': 'final_page'
}

# --- Final page ---

FINAL_PAGE = {
    'title': 'Gefeliciteerd!',
    'main_message': 'Je hebt de schattenjacht voltooid! 🎉',
    'subtitle': 'Alle uitdagingen zijn succesvol afgerond!',
    'emoji': '🏆',
    'location_text': 'Je cadeau ligt in',
    'location': 'het berenhol'
}

# --- Physical Clue Configuration ---
CLUE_CODE_MESSAGE = "ben jij een stout kindeke geweest?"
CLUE_CODE_ANSWER = "ben jij een stout kindeke geweest?" # The required answer (should match the message)

# --- Digital Clue Configuration ---
TREASURE_HUNT = {
    'clues': [
        {
            'question': 'I have keys but no locks. I have space but no room. You can enter but cannot go outside. What am I?',
            'answer': 'keyboard',
            'hint': 'You use this to type messages'
        },
        {
            'question': 'I am always running but never get tired. I have a face but no eyes. What am I?',
            'answer': 'clock',
            'hint': 'Tick tock, tick tock...'
        },
        {
            'question': 'I get wetter the more I dry. What am I?',
            'answer': 'towel',
            'hint': 'You use this after a shower'
        },
        {
            # This final digital clue leads to the physical Clue Phone
            'question': 'I have a head and a tail but no body. The final clue is displayed on the screen of the device hidden **near the coins**.',
            'answer': 'coin',
            'hint': 'Flip me to make a decision'
        }
    ],
    'treasure_message': '🎉 Congratulations! Je bent geen stout kindeke geweest! 🏆'
}