# ✍️ PoetryVerse

PoetryVerse is a community-driven poetry-sharing platform built with Flask that empowers users to write, share, explore, and interact with poems in a creative, expressive, and thoughtful environment.

This platform blends artistic expression with full-stack engineering and community features, including real-time chat, collaborative discovery, and dynamic filtering by poetic themes and popularity.

---

## 🚀 Features

### 👤 User System
- Secure user authentication and session management
- Public profiles with bios and profile images
- Follow system (many-to-many users)
- Personalized profile page with your poems, collections, and followed users

### 📝 Poems
- Create, edit, delete poems with preserved line breaks
- Tagging system (many-to-many)
- Visibility options: `public` / `private`
- Commenting and favoriting enabled
- Sorted by newest or most interacted (comment count)

### 📚 Collections
- Group poems into themed collections
- Set visibility for entire collections (cascades to poems)
- Poem count displayed on both profile and collection pages

### 🔍 Explore & Search
- Explore poems filtered by tags and sorted by interaction or date
- Global search across:
  - Poems
  - Users
  - Prompts

### 💬 Real-Time Chat
- Real-time messaging using Flask-SocketIO
- Typing indicators
- Profile pictures and usernames shown
- Clickable profile images link to public user profiles

### 🤖 Intelligent Recommendations
- Tag-based filtering for personalized suggestions
- Collaborative filtering to surface relevant poems based on interaction patterns

### 🎨 Design & UI
- Clean, responsive design using Bootstrap
- Professional padding, margin, and layout refinements
- Visual consistency across chat, explore, profile, and collection pages

---

## 🧠 Tech Stack

- **Backend**: Flask, Flask-SocketIO, SQLAlchemy
- **Frontend**: Jinja2, Bootstrap 5, custom CSS
- **Database**: SQLite (development), PostgreSQL recommended for production
- **Hosting**: PythonAnywhere (current), planning AWS migration
- **Real-Time**: WebSockets with Socket.IO
- **Recommendation Engine**: Tag-based + Collaborative Filtering

---

## ⚙️ Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/PoetryVerse.git
cd PoetryVerse
```

### 2. Create and Activate Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate  # on Windows: venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Set Environment Variables

Create a `.env` file and set:

```bash
SECRET_KEY=your_secret_key
DATABASE_URL=sqlite:///site.db  # or your preferred DB
```

### 5. Initialize Database

```bash
flask db init
flask db migrate -m "Initial migration"
flask db upgrade
```

### 6. Run the App

```bash
python app.py
```

---

## 🧪 Testing

You can manually test core features:

### General

- Register/login/logout flows
- Create and edit poems with newlines
- Add collections and assign visibility
- Follow/unfollow users from profiles

### Real-Time Chat

- Open two users in separate windows
- Send messages and verify live update
- Confirm typing indicator and clickable profile avatars

### Explore Page

- Apply tag filters
- Test sort-by "Most Interacted"
- Confirm recommended poems update on interaction

---

## 📦 Deployment Notes

- Current deployment: PythonAnywhere (Hacker Tier)
- Known Issue: Performance on PythonAnywhere is slow — planning migration to AWS Free Tier with PostgreSQL and Docker containerization for scalability

















