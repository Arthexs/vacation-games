import socket
import qrcode
from io import BytesIO
import base64
import os
from flask import current_app

# --- UTILITY FUNCTIONS ---
def get_local_ip():
    """Get the local IP address of this machine"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def generate_qr_code(url, size=10):
    """Generate a QR code for the given URL and return base64 string"""
    qr = qrcode.QRCode(version=1, box_size=size, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64 for display in HTML
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return img_str

# --- MOUNTAIN CHALLENGE FUNCTIONS ---
def get_mountain_names():
    """Get all mountain names from the mountain_images folder"""
    mountain_dir = os.path.join('static', 'mountain_images')
    if os.path.exists(mountain_dir):
        files = [f for f in os.listdir(mountain_dir) if f.endswith('.jpg')]
        # Convert filenames to display names
        return [filename_to_display_name(f) for f in files]
    return []

def filename_to_display_name(filename):
    """Convert filename to display name: monte_pelmo.jpg -> Monte Pelmo"""
    name = filename.replace('.jpg', '').replace('_', ' ')
    return name.title()

def display_name_to_filename(display_name):
    """Convert display name to filename: Monte Pelmo -> monte_pelmo.jpg"""
    return display_name.lower().replace(' ', '_') + '.jpg'